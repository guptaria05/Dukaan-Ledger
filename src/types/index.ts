export type Product={id:string;name:string;sku:string|null;category:string;unit:string;purchasePricePaise:number;sellingPricePaise:number;stockQuantity:number;lowStockThreshold:number};
export type Customer={id:string;name:string;phone:string|null};
export type CustomerBalance=Customer&{outstandingPaise:number};
export type DashboardSummary={productCount:number;stockValuePaise:number;todaySalesPaise:number;todayGrossProfitPaise:number;outstandingPaise:number;lowStockCount:number};
export type SaleInput={productId:string;quantity:number;customerId?:string|null;paidPaise:number;paymentMethod:"cash"|"upi"|"bank"|"other"};
export type SaleResult={saleId:string;totalPaise:number;paidPaise:number;outstandingPaise:number;grossProfitPaise:number};