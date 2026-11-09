import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL } from "./schema";
import type { Customer, CustomerBalance, DashboardSummary, Product, SaleInput, SaleResult } from "@/types";
import { calculateGrossProfit, calculateLineTotal, calculateOutstanding } from "@/lib/finance";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
const makeId = (prefix:string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

export async function getDatabase():Promise<SQLite.SQLiteDatabase>{
  if(!databasePromise) databasePromise=(async()=>{const db=await SQLite.openDatabaseAsync("dukaan-ledger.db");await db.execAsync(SCHEMA_SQL);return db;})();
  return databasePromise;
}
export async function listProducts():Promise<Product[]>{
  const db=await getDatabase();const rows=await db.getAllAsync<any>("SELECT * FROM products ORDER BY name COLLATE NOCASE");
  return rows.map(r=>({id:r.id,name:r.name,sku:r.sku,category:r.category,unit:r.unit,purchasePricePaise:r.purchase_price_paise,sellingPricePaise:r.selling_price_paise,stockQuantity:r.stock_quantity,lowStockThreshold:r.low_stock_threshold}));
}
export async function addProduct(input:{name:string;sku?:string;category?:string;unit?:string;purchasePricePaise:number;sellingPricePaise:number;stockQuantity:number;lowStockThreshold?:number}):Promise<void>{
  if(!input.name.trim())throw new Error("Enter a product name.");
  if(!Number.isSafeInteger(input.purchasePricePaise)||input.purchasePricePaise<0||!Number.isSafeInteger(input.sellingPricePaise)||input.sellingPricePaise<0)throw new Error("Enter valid prices.");
  if(!Number.isSafeInteger(input.stockQuantity)||input.stockQuantity<0)throw new Error("Stock must be a whole number.");
  const db=await getDatabase();const productId=makeId("prd");
  await db.runAsync("INSERT INTO products(id,name,sku,category,unit,purchase_price_paise,selling_price_paise,stock_quantity,low_stock_threshold) VALUES(?,?,?,?,?,?,?,?,?)",productId,input.name.trim(),input.sku?.trim()||null,input.category?.trim()||"General",input.unit?.trim()||"piece",input.purchasePricePaise,input.sellingPricePaise,input.stockQuantity,input.lowStockThreshold??5);
  await db.runAsync("INSERT INTO audit_events(id,entity_type,entity_id,action) VALUES(?,?,?,?)",makeId("aud"),"product",productId,"created");
}
export async function addCustomer(input:{name:string;phone?:string}):Promise<void>{
  if(!input.name.trim())throw new Error("Enter a customer name.");const db=await getDatabase();
  await db.runAsync("INSERT INTO customers(id,name,phone) VALUES(?,?,?)",makeId("cus"),input.name.trim(),input.phone?.trim()||null);
}
export async function listCustomers():Promise<Customer[]>{
  const db=await getDatabase();return db.getAllAsync<Customer>("SELECT id,name,phone FROM customers ORDER BY name COLLATE NOCASE");
}
export async function listCustomerBalances():Promise<CustomerBalance[]>{
  const db=await getDatabase();return db.getAllAsync<CustomerBalance>(`SELECT c.id,c.name,c.phone,
    COALESCE((SELECT SUM(s.total_paise) FROM sales s WHERE s.customer_id=c.id),0)-COALESCE((SELECT SUM(p.amount_paise) FROM payments p WHERE p.customer_id=c.id),0) AS outstandingPaise
    FROM customers c ORDER BY outstandingPaise DESC,c.name COLLATE NOCASE`);
}
export async function recordSale(input:SaleInput):Promise<SaleResult>{
  if(!Number.isSafeInteger(input.quantity)||input.quantity<=0)throw new Error("Quantity must be a positive whole number.");
  const db=await getDatabase();const product=await db.getFirstAsync<any>("SELECT * FROM products WHERE id=?",input.productId);
  if(!product)throw new Error("Product not found.");if(product.stock_quantity<input.quantity)throw new Error("Not enough stock available.");
  const total=calculateLineTotal(product.selling_price_paise,input.quantity);
  if(input.paidPaise<0||input.paidPaise>total||!Number.isSafeInteger(input.paidPaise))throw new Error("Payment must be between zero and the bill total.");
  if(input.customerId&&!await db.getFirstAsync("SELECT id FROM customers WHERE id=?",input.customerId))throw new Error("Customer not found.");
  const saleId=makeId("sal");const outstanding=calculateOutstanding(total,input.paidPaise);
  const grossProfit=calculateGrossProfit(product.selling_price_paise,product.purchase_price_paise,input.quantity);
  await db.withTransactionAsync(async()=>{
    await db.runAsync("INSERT INTO sales(id,customer_id,total_paise) VALUES(?,?,?)",saleId,input.customerId??null,total);
    await db.runAsync("INSERT INTO sale_items(id,sale_id,product_id,product_name_snapshot,quantity,unit_cost_paise,unit_price_paise) VALUES(?,?,?,?,?,?,?)",makeId("itm"),saleId,product.id,product.name,input.quantity,product.purchase_price_paise,product.selling_price_paise);
    await db.runAsync("UPDATE products SET stock_quantity=stock_quantity-?,updated_at=CURRENT_TIMESTAMP WHERE id=?",input.quantity,product.id);
    if(input.paidPaise>0)await db.runAsync("INSERT INTO payments(id,customer_id,sale_id,amount_paise,method) VALUES(?,?,?,?,?)",makeId("pay"),input.customerId??null,saleId,input.paidPaise,input.paymentMethod);
    await db.runAsync("INSERT INTO audit_events(id,entity_type,entity_id,action) VALUES(?,?,?,?)",makeId("aud"),"sale",saleId,"created");
  });
  return{saleId,totalPaise:total,paidPaise:input.paidPaise,outstandingPaise:outstanding,grossProfitPaise:grossProfit};
}
export async function recordCustomerPayment(input:{customerId:string;amountPaise:number;method:"cash"|"upi"|"bank"|"other";note?:string}):Promise<void>{
  if(!Number.isSafeInteger(input.amountPaise)||input.amountPaise<=0)throw new Error("Payment must be greater than zero.");
  const db=await getDatabase();const row=await db.getFirstAsync<{balance:number}>(`SELECT COALESCE((SELECT SUM(total_paise) FROM sales WHERE customer_id=?),0)-COALESCE((SELECT SUM(amount_paise) FROM payments WHERE customer_id=?),0) AS balance`,input.customerId,input.customerId);
  if(!row||row.balance<=0)throw new Error("This customer has no outstanding balance.");if(input.amountPaise>row.balance)throw new Error("Payment cannot exceed the outstanding balance.");
  await db.runAsync("INSERT INTO payments(id,customer_id,amount_paise,method,note) VALUES(?,?,?,?,?)",makeId("pay"),input.customerId,input.amountPaise,input.method,input.note?.trim()||null);
}
export async function recordPurchase(input:{productId:string;quantity:number;unitCostPaise:number;supplierName?:string}):Promise<void>{
  if(!Number.isSafeInteger(input.quantity)||input.quantity<=0)throw new Error("Quantity must be a positive whole number.");
  if(!Number.isSafeInteger(input.unitCostPaise)||input.unitCostPaise<0)throw new Error("Enter a valid purchase price.");
  const db=await getDatabase();if(!await db.getFirstAsync("SELECT id FROM products WHERE id=?",input.productId))throw new Error("Product not found.");
  await db.withTransactionAsync(async()=>{
    await db.runAsync("INSERT INTO purchases(id,product_id,quantity,unit_cost_paise,total_paise,supplier_name) VALUES(?,?,?,?,?,?)",makeId("pur"),input.productId,input.quantity,input.unitCostPaise,input.quantity*input.unitCostPaise,input.supplierName?.trim()||null);
    await db.runAsync("UPDATE products SET stock_quantity=stock_quantity+?,purchase_price_paise=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",input.quantity,input.unitCostPaise,input.productId);
  });
}
export async function getDashboardSummary():Promise<DashboardSummary>{
  const db=await getDatabase();const row=await db.getFirstAsync<any>(`SELECT (SELECT COUNT(*) FROM products) AS productCount,
    COALESCE((SELECT SUM(stock_quantity*purchase_price_paise) FROM products),0) AS stockValuePaise,
    COALESCE((SELECT SUM(total_paise) FROM sales WHERE date(created_at)=date('now','localtime')),0) AS todaySalesPaise,
    COALESCE((SELECT SUM((si.unit_price_paise-si.unit_cost_paise)*si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.created_at)=date('now','localtime')),0) AS todayGrossProfitPaise,
    COALESCE((SELECT SUM(total_paise) FROM sales WHERE customer_id IS NOT NULL),0)-COALESCE((SELECT SUM(amount_paise) FROM payments WHERE customer_id IS NOT NULL),0) AS outstandingPaise,
    (SELECT COUNT(*) FROM products WHERE stock_quantity<=low_stock_threshold) AS lowStockCount`);
  return row as DashboardSummary;
}
export async function getMonthlyGrossProfit():Promise<{month:string;profitPaise:number}[]>{
  const db=await getDatabase();return db.getAllAsync<{month:string;profitPaise:number}>(`SELECT strftime('%Y-%m',s.created_at) AS month,SUM((si.unit_price_paise-si.unit_cost_paise)*si.quantity) AS profitPaise
    FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE s.created_at>=date('now','-11 months','start of month') GROUP BY strftime('%Y-%m',s.created_at) ORDER BY month`);
}
