// Field names mirror data/vehicles.json (snake_case) so the dataset imports
// as Vehicle[] with no transformation. UI labels live in the display layer.

export type TitleStatus = 'clean' | 'salvage' | 'rebuilt';
export type FuelType = 'gasoline' | 'hybrid' | 'electric' | 'diesel';
export type Drivetrain = 'FWD' | 'AWD' | '4WD' | 'RWD';
export type Transmission = 'automatic' | 'manual' | 'CVT' | 'single-speed';
export type BodyStyle = 'SUV' | 'sedan' | 'coupe' | 'hatchback' | 'truck';

export interface Vehicle {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: BodyStyle;
  exterior_color: string;
  interior_color: string;
  engine: string;
  transmission: Transmission;
  drivetrain: Drivetrain;
  odometer_km: number;
  fuel_type: FuelType;
  condition_grade: number;
  condition_report: string;
  damage_notes: string[];
  title_status: TitleStatus;
  province: string;
  city: string;
  auction_start: string;
  starting_bid: number;
  reserve_price: number | null;
  buy_now_price: number | null;
  images: string[];
  selling_dealership: string;
  lot: string;
  current_bid: number;
  bid_count: number;
}

export interface UserBid {
  amount: number;
  placedAt: string;
}
