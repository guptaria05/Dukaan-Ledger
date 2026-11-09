export const SCHEMA_SQL=`
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,sku TEXT,category TEXT NOT NULL DEFAULT 'General',unit TEXT NOT NULL DEFAULT 'piece',purchase_price_paise INTEGER NOT NULL CHECK(purchase_price_paise>=0),selling_price_paise INTEGER NOT NULL CHECK(selling_price_paise>=0),stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(low_stock_threshold>=0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL AND sku<>'';
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,phone TEXT,notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE TABLE IF NOT EXISTS sales(id TEXT PRIMARY KEY NOT NULL,customer_id TEXT REFERENCES customers(id),total_paise INTEGER NOT NULL CHECK(total_paise>=0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,status TEXT NOT NULL DEFAULT 'completed');
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE TABLE IF NOT EXISTS sale_items(id TEXT PRIMARY KEY NOT NULL,sale_id TEXT NOT NULL REFERENCES sales(id),product_id TEXT REFERENCES products(id),product_name_snapshot TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),unit_cost_paise INTEGER NOT NULL CHECK(unit_cost_paise>=0),unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise>=0));
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY NOT NULL,customer_id TEXT REFERENCES customers(id),sale_id TEXT REFERENCES sales(id),amount_paise INTEGER NOT NULL CHECK(amount_paise>0),method TEXT NOT NULL CHECK(method IN('cash','upi','bank','other')),note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY NOT NULL,product_id TEXT NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL CHECK(quantity>0),unit_cost_paise INTEGER NOT NULL CHECK(unit_cost_paise>=0),total_paise INTEGER NOT NULL CHECK(total_paise>=0),supplier_name TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS expenses(id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,amount_paise INTEGER NOT NULL CHECK(amount_paise>0),category TEXT NOT NULL DEFAULT 'Other',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`;