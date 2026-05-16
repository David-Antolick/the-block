---
name: windows-localhost-ipv6
description: Diagnose and fix the Windows IPv6-first localhost gotcha — HTTP / TCP / DB calls to `localhost` hang for ~2 seconds each on Windows because the OS resolves to `::1` (IPv6) first and waits for the connection to time out before falling back to IPv4 `127.0.0.1`. Use when a local service feels slow on Windows, when a per-call latency floor is suspiciously close to a round number of seconds, when only Windows users report a performance regression, or when benchmarks show fast handler logic but slow end-to-end times.
---

# Windows `localhost` IPv6 Fallback

On Windows, `localhost` resolves to `::1` (IPv6) **before** `127.0.0.1` (IPv4). If the local service you're calling only binds to IPv4 — which most do by default — every connection burns ~2 seconds waiting for the IPv6 attempt to time out before the OS falls back. The bug looks like a slow application; it's actually a slow DNS-to-socket dance happening *outside* your code.

This tax is invisible on Linux and macOS (different fallback behavior, different timeouts), so it's the textbook "works on my machine" cross-platform footgun.

## When to apply

Trigger on any of:
- A Windows user reports 1–3 second latency on a local service that's fast on the same dev's Mac/Linux box
- End-to-end timing is slow but profilers show the handler executing in milliseconds
- A per-call latency floor sits suspiciously close to a round number (2 s, 4 s, 6 s — IPv6 fallback timeout, or a multiple if you make N calls)
- Code uses `http://localhost:<port>/...` or `localhost` in a DB connection string and the target service binds only to IPv4
- A benchmark with mocked I/O shows the function is fast, but the real run is slow (compounds with the "microbench-vs-reality" trap)

Do **not** trigger on: latency that scales with payload size (that's bandwidth, not resolution), or services that bind to both stacks (modern Postgres, modern nginx — these don't show the symptom).

## Why this happens

Windows' DNS resolver, `getaddrinfo`, returns address records in OS-configured order. The default on Windows 10/11 prefers IPv6 (`::1`) when the host is `localhost`. The connect attempt to `::1` fails fast only if *something* is listening on IPv6 and refusing — but if nothing's bound there at all, the connect waits for the TCP SYN to time out. That timeout is typically **~2 seconds per attempt** (controlled by `TcpInitialRtt`, default 2000 ms, with one retransmit).

Each HTTP call pays this independently, so:
- 1 call → ~2 s overhead
- A handler that issues 2 back-to-back calls → ~4 s overhead
- Polling at 1 Hz → permanent ~2 s lag on every tick

`localhost`-style names that also hit fallback chains: `host.docker.internal` (LLMNR / NetBIOS fallback), `<machine-name>.local` (mDNS fallback), `localhost.localdomain` (uncommon but extant).

## The fix

**Replace `localhost` with the literal IPv4 address `127.0.0.1`** at the call site. Defer the change to runtime if you have to read a config value:

```python
# Python — coerce at client construction
raw_host = os.getenv("MY_SERVICE_HOST", "127.0.0.1")
host = "127.0.0.1" if raw_host.lower() == "localhost" else raw_host
```

```typescript
// TypeScript — same idea
const rawHost = process.env.MY_SERVICE_HOST ?? "127.0.0.1";
const host = rawHost.toLowerCase() === "localhost" ? "127.0.0.1" : rawHost;
```

```yaml
# Config defaults: use 127.0.0.1, not localhost
service:
  host: 127.0.0.1   # not "localhost"
  port: 9863
```

**Always include the coercion even if the default is `127.0.0.1`** — users with existing configs will still have `localhost` from old setups, and the symptom is unreported until someone benchmarks. Coerce silently; don't make the user discover this themselves.

While you're there: use a connection-pooling client (`requests.Session`, `httpx.Client`, `aiohttp.ClientSession`) so even the TCP handshake amortizes across calls. Per-call `requests.get(...)` opens a new socket every time; with keep-alive you pay the handshake once.

## What this fix does NOT need

Don't reach for these — they don't address the root cause:

- **`asyncio` / threading the call.** Moves the wait off the event loop but doesn't shorten it. Wall clock is the same.
- **Lowering `TcpInitialRtt` via the registry.** Real fix but global, affects every program on the machine, and requires admin. Per-app coercion is local and safe.
- **Disabling IPv6 globally.** Breaks any service that actually uses IPv6. Wildly disproportionate.
- **Binding your service to IPv6 too.** Works if you control the service. Often you don't (Discord, SteelSeries, third-party local APIs).
- **Adding retries with shorter timeouts.** Pays the timeout *and* the retry cost; user-visible latency goes up, not down.

## Diagnostic recipe

When you suspect this, confirm in under 30 seconds:

1. **Time both names side by side:**
   ```powershell
   Measure-Command { Invoke-WebRequest -Uri "http://localhost:9863/api/v1/state" -UseBasicParsing }
   Measure-Command { Invoke-WebRequest -Uri "http://127.0.0.1:9863/api/v1/state" -UseBasicParsing }
   ```
   If the `localhost` form takes ~2 s more than the `127.0.0.1` form, this skill applies. If they're equal, look elsewhere.

2. **Check what the service actually binds to:**
   ```powershell
   netstat -ano | Select-String ":9863"
   ```
   If you see `127.0.0.1:9863` but no `[::1]:9863` or `[::]:9863`, the service is IPv4-only and confirms the diagnosis.

3. **Check Windows' resolution order:**
   ```powershell
   Resolve-DnsName localhost
   ```
   `::1` listed before `127.0.0.1` is the default.

## Cross-platform notes

- **Linux**: glibc's `getaddrinfo` reorders based on `/etc/gai.conf`. The default precedence table prefers IPv4 for loopback. Symptom does not appear.
- **macOS**: similar to Linux — loopback IPv4 preferred for unspecified families. Symptom does not appear.
- **Windows**: IPv6-first for `localhost` is the default. Symptom appears unless you bypass it.

If you ship to all three, **don't conditionally fix only for Windows**. Coerce `localhost` → `127.0.0.1` universally — Linux/macOS don't care, and the conditional adds complexity for no gain.

## Anti-patterns

### "It's slow because Python's HTTP client is slow"
The Python client is fine. The handshake is fine. The 2 seconds is the kernel waiting for an IPv6 SYN that no one will answer.

### Wrapping in `asyncio.to_thread` to "free up the loop"
The event loop is freed. The wall clock is identical. The user still waits.

### Telling the user to edit their config
Every existing install ships with `localhost` from someone's first README example. The symptom is unreported until someone benchmarks. Silent runtime coercion is the right move; making each user discover and fix this themselves is hostile.

### Hardcoding `127.0.0.1` without a config override
Some users legitimately need `localhost` to resolve to something else — Docker users with `host.docker.internal`, dev containers, VPN-bridged setups. Keep the env var; coerce only the literal string `"localhost"`.

## Quick reference: typical magnitudes

| Symptom | IPv6 fallback signature |
|---|---|
| Single REST call ~2 s slow | Yes — 1× timeout |
| Back-to-back calls scale linearly | Yes — N× timeout |
| First call slow, subsequent calls fast | **No** — that's cold-cache or lazy init, different skill |
| Slow only on Windows | Strong yes |
| Slow on Mac/Linux too | No — root cause is elsewhere |
| Slow only when handler does network I/O | Yes — handler logic itself is fine |
| Slow on all calls regardless of endpoint | Yes — applies per-socket, not per-route |

## Related lessons

- **Don't benchmark with stubs.** A microbench that mocks `requests.post` won't see this. Live wall-clock numbers from a real run are the only reliable measurement when localhost is involved.
- **Observability pays off.** A timing breakdown that separates DNS / connect / send / recv catches this in one log line. Building that breakdown after the fact, you'll spend hours profiling Python.
