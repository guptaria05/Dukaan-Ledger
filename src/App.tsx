import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IconOverview,
  IconInventory,
  IconSales,
  IconCustomers,
  IconVendors,
  IconExpenses,
  IconReports,
  IconSeasons,
  IconSearch,
  IconPlus,
  IconSun,
  IconMoon,
  IconDownload,
  IconAlertTriangle,
  IconCheckCircle,
  IconClose,
  IconPhone,
  IconArrowUpRight,
  IconMore,
  IconIndianRupee,
  IconSparkles,
} from "./Icons";

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  threshold: number;
  expiryDate?: string;
  createdAt?: string;
  seasonIds?: string[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  createdAt?: string;
};

export type Sale = {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  qty: number;
  total: number;
  paid: number;
  cost: number;
  date: string;
  createdAt?: string;
};

export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
};

export type Vendor = {
  id: string;
  name: string;
  phone: string;
  category: string;
  createdAt: string;
};

export type Purchase = {
  id: string;
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  qty: number;
  unitCost: number;
  total: number;
  date: string;
  createdAt: string;
};

export type StockMove = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  date: string;
  kind: "opening" | "purchase";
};

export type Season = {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  notes: string;
  productIds: string[];
};

export type Data = {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
  vendors: Vendor[];
  purchases: Purchase[];
  stockMoves: StockMove[];
  seasons: Season[];
};

export type Tab =
  | "Overview"
  | "Inventory"
  | "Sales"
  | "Customers"
  | "Vendors"
  | "Expenses"
  | "Reports"
  | "Seasons";

type ModalType =
  | null
  | "add-product"
  | "record-sale"
  | "add-customer"
  | "collect-payment"
  | "restock"
  | "add-expense"
  | "add-vendor"
  | "add-season"
  | "quick-menu"
  | "more-menu";

const LEGACY_KEY = "dukaan-ledger-web-v1";
const storageKey = () => {
  const accountId = localStorage.getItem("dukaan-active-user-id");
  return accountId ? LEGACY_KEY + ":" + accountId : LEGACY_KEY;
};
const EMPTY: Data = {
  products: [],
  customers: [],
  sales: [],
  expenses: [],
  vendors: [],
  purchases: [],
  stockMoves: [],
  seasons: [],
};

const uid = () => crypto.randomUUID();
const isoNow = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const rupees = (p: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format((p || 0) / 100);

const cents = (s: string) => Math.max(0, Math.round(Number(s || 0) * 100));

const dateText = (s: string) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const monthKey = (d: string) => d.slice(0, 7);

function read(): Data {
  try {
    const x = JSON.parse(localStorage.getItem(storageKey()) || "{}");
    return {
      ...EMPTY,
      ...x,
      customers: (x.customers || []).map((c: Customer) => ({
        ...c,
        createdAt: c.createdAt || "",
      })),
      products: (x.products || []).map((p: Product) => ({
        ...p,
        expiryDate: p.expiryDate || "",
        createdAt: p.createdAt || "",
        seasonIds: p.seasonIds || [],
      })),
      vendors: x.vendors || [],
      purchases: x.purchases || [],
      stockMoves: x.stockMoves || [],
      seasons: x.seasons || [],
    };
  } catch {
    return EMPTY;
  }
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  min,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {required && <em className="required-mark">*</em>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoFocus={autoFocus}
        min={min ?? (type === "number" ? "0" : undefined)}
        className="field-input"
      />
    </label>
  );
}

const csvCell = (v: unknown) => '"' + String(v ?? "").replaceAll('"', '""') + '"';

function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob(
    ["\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\n")],
    { type: "text/csv;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [data, setData] = useState<Data>(read);
  const [tab, setTab] = useState<Tab>("Overview");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("dukaan-ledger-theme") === "dark" ? "dark" : "light")
  );

  // Filter chips state
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [salesStatusFilter, setSalesStatusFilter] = useState<"All" | "Paid" | "Due">("All");
  const [customerDueFilter, setCustomerDueFilter] = useState<"All" | "Due" | "Settled">("All");

  // Chart state
  const [period, setPeriod] = useState<"Year" | "Month" | "Day">("Year");
  const [chartYear, setChartYear] = useState(String(new Date().getFullYear()));
  const [chartMonth, setChartMonth] = useState(today().slice(0, 7));
  const [chartDay, setChartDay] = useState(today());
  const [hoveredBar, setHoveredBar] = useState<{ label: string; value: number } | null>(null);

  // Modals / Drawers
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Forms
  const [pform, setPform] = useState({
    name: "",
    sku: "",
    category: "Vegetables",
    cost: "",
    price: "",
    stock: "0",
    threshold: "5",
  });
  const [sform, setSform] = useState({
    product: "",
    customer: "",
    qty: "1",
    paid: "",
    selling: "",
  });
  const [cform, setCform] = useState({ name: "", phone: "" });
  const [eform, setEform] = useState({ title: "", category: "Utilities", amount: "" });
  const [restock, setRestock] = useState({ product: "", vendor: "", qty: "1", cost: "" });
  const [vform, setVform] = useState({ name: "", phone: "", category: "General" });
  const [collect, setCollect] = useState({ customer: "", amount: "" });
  const [seasonForm, setSeasonForm] = useState({
    name: "",
    startMonth: "10",
    endMonth: "11",
    notes: "",
    productIds: [] as string[],
  });

  useEffect(() => {
    localStorage.setItem("dukaan-ledger-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(storageKey(), JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("dukaan:data-updated", { detail: data }));
  }, [data]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const startMonth = today().slice(0, 7) + "-01";
  const startYear = today().slice(0, 4) + "-01-01";

  const todaySales = data.sales.filter((s) => s.date === today());
  const salesToday = todaySales.reduce((a, s) => a + s.total, 0);

  const monthSales = data.sales.filter((s) => s.date >= startMonth && s.date <= today());
  const salesMtd = monthSales.reduce((a, s) => a + s.total, 0);

  const yearSales = data.sales.filter((s) => s.date >= startYear && s.date <= today());
  const salesYtd = yearSales.reduce((a, s) => a + s.total, 0);

  const dues = data.sales.reduce((a, s) => a + s.total - s.paid, 0);
  const stockValue = data.products.reduce((a, p) => a + p.cost * p.stock, 0);
  const low = data.products.filter((p) => p.stock <= p.threshold);

  const monthExpenses = data.expenses
    .filter((e) => e.date >= startMonth && e.date <= today())
    .reduce((a, e) => a + e.amount, 0);
  const monthCogs = monthSales.reduce((a, s) => a + s.cost * s.qty, 0);
  const profitMtd = salesMtd - monthCogs - monthExpenses;

  // Balance calculation per customer
  const balance = (id: string) =>
    data.sales.filter((s) => s.customerId === id).reduce((a, s) => a + s.total - s.paid, 0);

  // Dynamic Categories extracted from products
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    data.products.forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return ["All", ...Array.from(set)];
  }, [data.products]);

  // Filtered Products
  const products = useMemo(() => {
    return data.products.filter((p) => {
      const matchSearch = (p.name + " " + p.sku + " " + p.category)
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchCategory =
        categoryFilter === "All" || p.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchLowStock = !lowStockOnly || p.stock <= p.threshold;
      return matchSearch && matchCategory && matchLowStock;
    });
  }, [data.products, search, categoryFilter, lowStockOnly]);

  // Filtered Customers
  const customers = useMemo(() => {
    return data.customers.filter((c) => {
      const matchSearch = (c.name + " " + c.phone).toLowerCase().includes(search.toLowerCase());
      const bal = balance(c.id);
      const matchDue =
        customerDueFilter === "All" ||
        (customerDueFilter === "Due" && bal > 0) ||
        (customerDueFilter === "Settled" && bal <= 0);
      return matchSearch && matchDue;
    });
  }, [data.customers, data.sales, search, customerDueFilter]);

  // Filtered Sales
  const filteredSales = useMemo(() => {
    return data.sales.filter((s) => {
      const matchSearch = (s.productName + " " + s.customerName)
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchStatus =
        salesStatusFilter === "All" ||
        (salesStatusFilter === "Paid" && s.paid >= s.total) ||
        (salesStatusFilter === "Due" && s.paid < s.total);
      return matchSearch && matchStatus;
    });
  }, [data.sales, search, salesStatusFilter]);

  const vendors = useMemo(
    () =>
      data.vendors.filter((v) =>
        (v.name + " " + v.category + " " + v.phone).toLowerCase().includes(search.toLowerCase())
      ),
    [data.vendors, search]
  );

  const changeTab = (t: Tab) => {
    setTab(t);
    setSearch("");
    setCategoryFilter("All");
    setLowStockOnly(false);
    setSalesStatusFilter("All");
    setCustomerDueFilter("All");
    setActiveModal(null);
  };

  const activeSeasons = data.seasons.filter((s) => {
    const m = new Date().getMonth() + 1;
    return s.startMonth <= s.endMonth
      ? m >= s.startMonth && m <= s.endMonth
      : m >= s.startMonth || m <= s.endMonth;
  });

  const addedUnitsMonth = data.stockMoves
    .filter((m) => monthKey(m.date) === today().slice(0, 7))
    .reduce((a, m) => a + m.qty, 0);

  const addedProductsMonth = data.products.filter(
    (p) => (p.createdAt || today()).slice(0, 7) === today().slice(0, 7)
  ).length;

  const chartRows = useMemo(() => {
    if (period === "Year") {
      return Array.from({ length: 12 }, (_, i) => {
        const key = chartYear + "-" + String(i + 1).padStart(2, "0");
        return {
          label: new Date(Number(chartYear), i, 1).toLocaleDateString("en-IN", {
            month: "short",
          }),
          value: data.sales
            .filter((s) => monthKey(s.date) === key)
            .reduce((a, s) => a + s.total, 0),
        };
      });
    }
    if (period === "Month") {
      const [y, m] = chartMonth.split("-").map(Number);
      const n = new Date(y, m, 0).getDate();
      return Array.from({ length: n }, (_, i) => {
        const day = String(i + 1).padStart(2, "0");
        const key = chartMonth + "-" + day;
        return {
          label: String(i + 1),
          value: data.sales
            .filter((s) => s.date === key)
            .reduce((a, s) => a + s.total, 0),
        };
      });
    }
    return Array.from({ length: 24 }, (_, h) => ({
      label: String(h).padStart(2, "0") + ":00",
      value: data.sales
        .filter(
          (s) =>
            s.date === chartDay &&
            new Date(s.createdAt || s.date + "T12:00:00").getHours() === h
        )
        .reduce((a, s) => a + s.total, 0),
    }));
  }, [data.sales, period, chartYear, chartMonth, chartDay]);

  const maxChart = Math.max(1, ...chartRows.map((x) => x.value));
  const selectedChartTotal = chartRows.reduce((a, x) => a + x.value, 0);

  const currentMonthNewCustomers = data.customers.filter(
    (c) => (c.createdAt || today()) >= startMonth && (c.createdAt || today()) <= today()
  );
  const lastMonthDate = new Date();
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const lastMonthCustomers = data.customers.filter(
    (c) => (c.createdAt || "").slice(0, 7) === lastMonth
  );

  // Form Handlers
  function addProduct(e: FormEvent) {
    e.preventDefault();
    const p: Product = {
      id: uid(),
      name: pform.name.trim(),
      sku: pform.sku.trim(),
      category: pform.category.trim() || "General",
      cost: cents(pform.cost),
      price: cents(pform.price),
      stock: Number(pform.stock),
      threshold: Number(pform.threshold),
      createdAt: today(),
      seasonIds: [],
    };
    const move: StockMove = {
      id: uid(),
      productId: p.id,
      productName: p.name,
      qty: p.stock,
      unitCost: p.cost,
      date: today(),
      kind: "opening",
    };
    setData((d) => ({
      ...d,
      products: [p, ...d.products],
      stockMoves: p.stock ? [move, ...d.stockMoves] : d.stockMoves,
    }));
    setPform({
      name: "",
      sku: "",
      category: "Vegetables",
      cost: "",
      price: "",
      stock: "0",
      threshold: "5",
    });
    setActiveModal(null);
    setNotice("✓ Product added to inventory successfully");
  }

  function addSale(e: FormEvent) {
    e.preventDefault();
    const p = data.products.find((x) => x.id === sform.product);
    const customer = data.customers.find((x) => x.id === sform.customer);
    if (!p) return;
    const qty = Math.floor(Number(sform.qty));
    const total = cents(sform.selling) * qty;
    const paid = cents(sform.paid);
    if (qty < 1 || qty > p.stock) {
      setNotice("⚠️ Not enough stock available for this product");
      return;
    }
    if (total <= 0) {
      setNotice("⚠️ Please enter a valid selling price");
      return;
    }
    if (paid > total) {
      setNotice("⚠️ Payment cannot exceed the total bill");
      return;
    }
    if (paid < total && !customer) {
      setNotice("⚠️ Please select a customer for credit sales");
      return;
    }
    const sale: Sale = {
      id: uid(),
      productId: p.id,
      productName: p.name,
      customerId: customer?.id || "",
      customerName: customer?.name || "Walk-in Customer",
      qty,
      total,
      paid,
      cost: p.cost,
      date: today(),
      createdAt: isoNow(),
    };
    setData((d) => ({
      ...d,
      sales: [sale, ...d.sales],
      products: d.products.map((x) => (x.id === p.id ? { ...x, stock: x.stock - qty } : x)),
    }));
    setSform({ product: "", customer: "", qty: "1", paid: "", selling: "" });
    setActiveModal(null);
    setNotice(`🎉 Sale of ${rupees(total)} recorded!`);
  }

  function addCustomer(e: FormEvent) {
    e.preventDefault();
    setData((d) => ({
      ...d,
      customers: [{ id: uid(), ...cform, createdAt: today() }, ...d.customers],
    }));
    setCform({ name: "", phone: "" });
    setActiveModal(null);
    setNotice("✓ Customer registered");
  }

  function addExpense(e: FormEvent) {
    e.preventDefault();
    setData((d) => ({
      ...d,
      expenses: [
        {
          id: uid(),
          title: eform.title,
          category: eform.category,
          amount: cents(eform.amount),
          date: today(),
        },
        ...d.expenses,
      ],
    }));
    setEform({ title: "", category: "Utilities", amount: "" });
    setActiveModal(null);
    setNotice("✓ Expense recorded");
  }

  function addRestock(e: FormEvent) {
    e.preventDefault();
    const p = data.products.find((x) => x.id === restock.product);
    const v = data.vendors.find((x) => x.id === restock.vendor);
    const q = Math.floor(Number(restock.qty));
    const cost = cents(restock.cost);
    if (!p || q < 1 || cost <= 0) return;
    const purchase: Purchase = {
      id: uid(),
      productId: p.id,
      productName: p.name,
      vendorId: v?.id || "",
      vendorName: v?.name || "Unspecified vendor",
      qty: q,
      unitCost: cost,
      total: cost * q,
      date: today(),
      createdAt: isoNow(),
    };
    const move: StockMove = {
      id: uid(),
      productId: p.id,
      productName: p.name,
      qty: q,
      unitCost: cost,
      date: today(),
      kind: "purchase",
    };
    setData((d) => ({
      ...d,
      products: d.products.map((x) =>
        x.id === p.id
          ? {
              ...x,
              cost: Math.round((x.cost * x.stock + cost * q) / (x.stock + q)),
              stock: x.stock + q,
            }
          : x
      ),
      purchases: [purchase, ...d.purchases],
      stockMoves: [move, ...d.stockMoves],
    }));
    setRestock({ product: "", vendor: "", qty: "1", cost: "" });
    setActiveModal(null);
    setNotice(`✓ Stock added: +${q} units for ${p.name}`);
  }

  function addVendor(e: FormEvent) {
    e.preventDefault();
    setData((d) => ({
      ...d,
      vendors: [{ id: uid(), ...vform, createdAt: today() }, ...d.vendors],
    }));
    setVform({ name: "", phone: "", category: "General" });
    setActiveModal(null);
    setNotice("✓ Vendor added to directory");
  }

  function collectPayment(e: FormEvent) {
    e.preventDefault();
    const amount = cents(collect.amount);
    if (!collect.customer || amount <= 0 || amount > balance(collect.customer)) {
      setNotice("⚠️ Enter a valid amount up to outstanding dues");
      return;
    }
    let left = amount;
    const next = data.sales
      .slice()
      .reverse()
      .map((s) => {
        if (s.customerId !== collect.customer || left <= 0) return s;
        const part = Math.min(s.total - s.paid, left);
        left -= part;
        return { ...s, paid: s.paid + part };
      })
      .reverse();
    setData((d) => ({ ...d, sales: next }));
    setCollect({ customer: "", amount: "" });
    setActiveModal(null);
    setNotice(`✓ Payment of ${rupees(amount)} received and adjusted`);
  }

  function addSeason(e: FormEvent) {
    e.preventDefault();
    setData((d) => ({
      ...d,
      seasons: [
        ...d.seasons,
        {
          id: uid(),
          name: seasonForm.name,
          startMonth: Number(seasonForm.startMonth),
          endMonth: Number(seasonForm.endMonth),
          notes: seasonForm.notes,
          productIds: seasonForm.productIds,
        },
      ],
    }));
    setSeasonForm({
      name: "",
      startMonth: "10",
      endMonth: "11",
      notes: "",
      productIds: [],
    });
    setActiveModal(null);
    setNotice("✓ Seasonal plan created");
  }

  function loadDemoData() {
    const day = (offset: number) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    };
    const stamp = (date: string, hour = 12) =>
      date + "T" + String(hour).padStart(2, "0") + ":00:00.000Z";
    const ids = {
      rice: "demo-p-rice",
      oil: "demo-p-oil",
      soap: "demo-p-soap",
      tomato: "demo-p-tomato",
      detergent: "demo-p-detergent",
      crackers: "demo-p-crackers",
    };
    const products: Product[] = [
      {
        id: ids.rice,
        name: "Basmati Rice (5 kg)",
        sku: "GRC-001",
        category: "Grocery",
        cost: 42000,
        price: 48500,
        stock: 24,
        threshold: 8,
        createdAt: day(-45),
        seasonIds: [],
      },
      {
        id: ids.oil,
        name: "Sunflower Oil (1 L)",
        sku: "GRC-002",
        category: "Grocery",
        cost: 12500,
        price: 14800,
        stock: 38,
        threshold: 10,
        createdAt: day(-35),
        seasonIds: [],
      },
      {
        id: ids.soap,
        name: "Dishwashing Bar",
        sku: "CLN-001",
        category: "Dishwashing",
        cost: 1800,
        price: 2500,
        stock: 4,
        threshold: 10,
        createdAt: day(-20),
        seasonIds: [],
      },
      {
        id: ids.tomato,
        name: "Fresh Tomatoes (1 kg)",
        sku: "VEG-001",
        category: "Vegetables",
        cost: 2800,
        price: 4000,
        stock: 16,
        threshold: 5,
        createdAt: day(-12),
        seasonIds: [],
      },
      {
        id: ids.detergent,
        name: "Detergent Powder (1 kg)",
        sku: "CLN-002",
        category: "Cleaning",
        cost: 7800,
        price: 9500,
        stock: 19,
        threshold: 6,
        createdAt: day(-8),
        seasonIds: [],
      },
      {
        id: ids.crackers,
        name: "Festive Sparkler Pack",
        sku: "SEA-001",
        category: "Seasonal",
        cost: 6500,
        price: 9000,
        stock: 3,
        threshold: 8,
        createdAt: day(-5),
        seasonIds: ["demo-season-diwali"],
      },
    ];
    const customers: Customer[] = [
      { id: "demo-c-1", name: "Aarav Sharma", phone: "9876543210", createdAt: day(-40) },
      { id: "demo-c-2", name: "Meera Verma", phone: "9812345678", createdAt: day(-18) },
      { id: "demo-c-3", name: "Kabir Singh", phone: "9988776655", createdAt: day(-6) },
      { id: "demo-c-4", name: "Ananya Gupta", phone: "9765432109", createdAt: day(-38) },
      { id: "demo-c-5", name: "Ishaan Kumar", phone: "9654321098", createdAt: day(-42) },
    ];
    const vendors: Vendor[] = [
      {
        id: "demo-v-1",
        name: "Sharma General Suppliers",
        phone: "9823456781",
        category: "Grocery & Staples",
        createdAt: day(-50),
      },
      {
        id: "demo-v-2",
        name: "Fresh Farm Wholesale",
        phone: "9734567812",
        category: "Vegetables",
        createdAt: day(-32),
      },
      {
        id: "demo-v-3",
        name: "CleanHome Distributors",
        phone: "9945678123",
        category: "Cleaning supplies",
        createdAt: day(-25),
      },
    ];
    const makeSale = (
      id: string,
      productId: string,
      productName: string,
      customerId: string,
      customerName: string,
      qty: number,
      price: number,
      cost: number,
      offset: number,
      hour: number,
      paid: number
    ): Sale => {
      const date = day(offset);
      return {
        id,
        productId,
        productName,
        customerId,
        customerName,
        qty,
        total: price * qty,
        paid,
        cost,
        date,
        createdAt: stamp(date, hour),
      };
    };
    const sales: Sale[] = [
      makeSale(
        "demo-s-1",
        ids.rice,
        "Basmati Rice (5 kg)",
        "demo-c-1",
        "Aarav Sharma",
        1,
        48500,
        42000,
        -40,
        11,
        48500
      ),
      makeSale(
        "demo-s-2",
        ids.oil,
        "Sunflower Oil (1 L)",
        "demo-c-2",
        "Meera Verma",
        2,
        14800,
        12500,
        -25,
        15,
        20000
      ),
      makeSale(
        "demo-s-3",
        ids.tomato,
        "Fresh Tomatoes (1 kg)",
        "demo-c-3",
        "Kabir Singh",
        3,
        4000,
        2800,
        -8,
        10,
        12000
      ),
      makeSale(
        "demo-s-4",
        ids.soap,
        "Dishwashing Bar",
        "demo-c-1",
        "Aarav Sharma",
        4,
        2500,
        1800,
        -5,
        13,
        10000
      ),
      makeSale(
        "demo-s-5",
        ids.detergent,
        "Detergent Powder (1 kg)",
        "demo-c-4",
        "Ananya Gupta",
        2,
        9500,
        7800,
        -3,
        17,
        19000
      ),
      makeSale(
        "demo-s-6",
        ids.oil,
        "Sunflower Oil (1 L)",
        "demo-c-2",
        "Meera Verma",
        1,
        14800,
        12500,
        -1,
        9,
        10000
      ),
      makeSale(
        "demo-s-7",
        ids.crackers,
        "Festive Sparkler Pack",
        "demo-c-5",
        "Ishaan Kumar",
        2,
        9000,
        6500,
        0,
        10,
        10000
      ),
      makeSale(
        "demo-s-8",
        ids.tomato,
        "Fresh Tomatoes (1 kg)",
        "demo-c-3",
        "Kabir Singh",
        2,
        4000,
        2800,
        0,
        14,
        8000
      ),
      makeSale(
        "demo-s-9",
        ids.rice,
        "Basmati Rice (5 kg)",
        "demo-c-1",
        "Aarav Sharma",
        1,
        48500,
        42000,
        -2,
        12,
        30000
      ),
      makeSale(
        "demo-s-10",
        ids.detergent,
        "Detergent Powder (1 kg)",
        "demo-c-4",
        "Ananya Gupta",
        1,
        9500,
        7800,
        -12,
        16,
        9500
      ),
    ];
    const expenses: Expense[] = [
      { id: "demo-e-1", title: "Shop electricity bill", category: "Utilities", amount: 185000, date: day(-4) },
      { id: "demo-e-2", title: "Local delivery & transport", category: "Transport", amount: 65000, date: day(-7) },
      { id: "demo-e-3", title: "Shop space rent", category: "Rent", amount: 850000, date: day(-2) },
    ];
    const purchases: Purchase[] = [
      {
        id: "demo-buy-1",
        productId: ids.rice,
        productName: "Basmati Rice (5 kg)",
        vendorId: "demo-v-1",
        vendorName: vendors[0].name,
        qty: 20,
        unitCost: 42000,
        total: 840000,
        date: day(-15),
        createdAt: stamp(day(-15)),
      },
      {
        id: "demo-buy-2",
        productId: ids.tomato,
        productName: "Fresh Tomatoes (1 kg)",
        vendorId: "demo-v-2",
        vendorName: vendors[1].name,
        qty: 25,
        unitCost: 2800,
        total: 70000,
        date: day(-4),
        createdAt: stamp(day(-4)),
      },
      {
        id: "demo-buy-3",
        productId: ids.detergent,
        productName: "Detergent Powder (1 kg)",
        vendorId: "demo-v-3",
        vendorName: vendors[2].name,
        qty: 15,
        unitCost: 7800,
        total: 117000,
        date: day(-2),
        createdAt: stamp(day(-2)),
      },
    ];
    const stockMoves: StockMove[] = [
      ...products.map((p) => ({
        id: "demo-open-" + p.id,
        productId: p.id,
        productName: p.name,
        qty: p.stock,
        unitCost: p.cost,
        date: p.createdAt || day(-10),
        kind: "opening" as const,
      })),
      ...purchases.map((p) => ({
        id: "demo-move-" + p.id,
        productId: p.productId,
        productName: p.productName,
        qty: p.qty,
        unitCost: p.unitCost,
        date: p.date,
        kind: "purchase" as const,
      })),
    ];
    const seasons: Season[] = [
      {
        id: "demo-season-diwali",
        name: "Diwali Festival",
        startMonth: 10,
        endMonth: 11,
        notes: "Stock up on festive gift sets, sparklers, and sweets ahead of the rush.",
        productIds: [ids.crackers],
      },
    ];
    setData({ products, customers, sales, expenses, vendors, purchases, stockMoves, seasons });
    setActiveModal(null);
    setNotice("✨ Demo shop data loaded successfully!");
  }

  // Pre-fill restock modal
  const openRestockFor = (productId: string) => {
    const prod = data.products.find((p) => p.id === productId);
    setRestock({
      product: productId,
      vendor: "",
      qty: "10",
      cost: prod ? String(prod.cost / 100) : "",
    });
    setActiveModal("restock");
  };

  // Pre-fill sale modal
  const openSaleFor = (productId: string) => {
    const prod = data.products.find((p) => p.id === productId);
    setSform({
      product: productId,
      customer: "",
      qty: "1",
      paid: prod ? String(prod.price / 100) : "",
      selling: prod ? String(prod.price / 100) : "",
    });
    setActiveModal("record-sale");
  };

  // Pre-fill collect payment modal
  const openCollectFor = (customerId: string) => {
    const dueAmount = balance(customerId);
    setCollect({
      customer: customerId,
      amount: dueAmount > 0 ? String(dueAmount / 100) : "",
    });
    setActiveModal("collect-payment");
  };

  const productOverview = () =>
    downloadCsv("dukaan-inventory-overview-" + today() + ".csv", [
      [
        "Product",
        "Category",
        "SKU",
        "Current stock",
        "Cost price (INR)",
        "Stock value (INR)",
        "Selling price (INR)",
        "Low stock threshold",
      ],
      ...data.products.map((p) => [
        p.name,
        p.category,
        p.sku,
        p.stock,
        p.cost / 100,
        (p.cost * p.stock) / 100,
        p.price / 100,
        p.threshold,
      ]),
    ]);

  const weeklyOverview = () => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const from = since.toISOString().slice(0, 10);
    downloadCsv("dukaan-weekly-stock-review-" + today() + ".csv", [
      [
        "Product",
        "Category",
        "Current stock",
        "Units added in last 7 days",
        "Cost price (INR)",
        "Stock value (INR)",
        "Low stock",
      ],
      ...data.products.map((p) => [
        p.name,
        p.category,
        p.stock,
        data.stockMoves
          .filter((m) => m.productId === p.id && m.date >= from)
          .reduce((a, m) => a + m.qty, 0),
        p.cost / 100,
        (p.cost * p.stock) / 100,
        p.stock <= p.threshold ? "Yes" : "No",
      ]),
    ]);
  };

  // Navigation Items
  const navItems: { label: Tab; icon: React.ReactNode; badge?: number }[] = [
    { label: "Overview", icon: <IconOverview /> },
    { label: "Inventory", icon: <IconInventory />, badge: low.length },
    { label: "Sales", icon: <IconSales /> },
    { label: "Customers", icon: <IconCustomers /> },
    { label: "Vendors", icon: <IconVendors /> },
    { label: "Expenses", icon: <IconExpenses /> },
    { label: "Reports", icon: <IconReports /> },
    { label: "Seasons", icon: <IconSeasons /> },
  ];

  // Mobile Bottom Bar items: 4 primary + More
  const mobilePrimaryTabs: Tab[] = ["Overview", "Inventory", "Sales", "Customers"];

  return (
    <div className={"app-shell " + (theme === "dark" ? "theme-dark" : "theme-light")}>
      {/* DESKTOP SIDEBAR */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-badge">द</div>
          <div className="brand-text">
            <strong>Dukaan Ledger</strong>
            <span>SHOP OS & LEDGER</span>
          </div>
        </div>

        <div className="store-pill">
          <div className="store-avatar">S</div>
          <div className="store-meta">
            <strong>My Dukaan</strong>
            <span>Live shop register</span>
          </div>
          <div className="online-dot" title="Local storage active" />
        </div>

        <div className="sidebar-group-title">WORKSPACE</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-button ${tab === item.label ? "active" : ""}`}
              onClick={() => changeTab(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-title">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="nav-badge alert-badge">{item.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="quick-help-card">
            <div className="help-icon">
              <IconSparkles size={16} />
            </div>
            <div className="help-info">
              <strong>Offline first</strong>
              <p>All records stored securely in your browser.</p>
            </div>
          </div>
          <div className="owner-profile">
            <div className="owner-avatar">{(localStorage.getItem("dukaan-active-user-name") || "S").charAt(0).toUpperCase()}</div>
            <div className="owner-info">
              <strong>{localStorage.getItem("dukaan-active-user-name") || "Shop Owner"}</strong>
              <span>{localStorage.getItem("dukaan-active-user-name") ? "Account owner" : "Active Terminal"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="app-main">
        {/* TOPBAR */}
        <header className="app-topbar">
          <div className="mobile-brand-bar">
            <div className="brand-badge small">द</div>
            <span className="mobile-title">Dukaan Ledger</span>
          </div>

          <div className="breadcrumb-box">
            <span className="crumb-root">Workspace</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{tab}</span>
          </div>

          <div className="topbar-actions">
            {/* Quick Action Button */}
            <button
              className="quick-action-btn desktop-only"
              onClick={() => setActiveModal("quick-menu")}
              title="Quick Action"
            >
              <IconPlus size={15} />
              <span>Quick Action</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              className="theme-switch-btn"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-label="Theme toggle"
            >
              {theme === "light" ? <IconMoon size={16} /> : <IconSun size={16} />}
              <span className="theme-label">{theme === "light" ? "Dark" : "Light"}</span>
            </button>

            <div className="date-badge desktop-only">{dateText(today())}</div>
            <button
              className="profile-pill desktop-only"
              title="Sign out"
              aria-label="Sign out of Dukaan Ledger"
              onClick={() => window.dispatchEvent(new Event("dukaan:logout"))}
            >
              {(localStorage.getItem("dukaan-active-user-name") || "S").charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <div className="main-viewport">
          {/* HEADER BANNER */}
          <div className="page-header">
            <div className="header-titles">
              <span className="subhead-pill">
                {tab === "Overview" ? "SHOP ANALYTICS & INSIGHTS" : "MANAGEMENT MODULE"}
              </span>
              <h1 className="header-main-title">
                {tab === "Overview" ? "Dukaan Overview" : tab}
              </h1>
              <p className="header-description">
                {tab === "Overview"
                  ? "Real-time summary of sales, stock levels, dues, and profits."
                  : `Manage and track ${tab.toLowerCase()} effortlessly.`}
              </p>
            </div>

            <div className="header-right-actions">
              {tab === "Overview" &&
                data.products.length === 0 &&
                data.customers.length === 0 &&
                data.sales.length === 0 && (
                  <button className="btn btn-secondary load-demo-btn" onClick={loadDemoData}>
                    <IconSparkles size={16} />
                    <span>Load sample shop data</span>
                  </button>
                )}

              {/* Contextual primary action buttons for faster workflow */}
              {tab === "Inventory" && (
                <div className="action-row">
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveModal("add-product")}
                  >
                    <IconPlus size={16} />
                    <span>Add Product</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setActiveModal("restock")}
                  >
                    <span>Restock / Stock In</span>
                  </button>
                </div>
              )}
              {tab === "Sales" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveModal("record-sale")}
                >
                  <IconPlus size={16} />
                  <span>Record Sale</span>
                </button>
              )}
              {tab === "Customers" && (
                <div className="action-row">
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveModal("add-customer")}
                  >
                    <IconPlus size={16} />
                    <span>Add Customer</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setActiveModal("collect-payment")}
                  >
                    <span>Collect Payment</span>
                  </button>
                </div>
              )}
              {tab === "Expenses" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveModal("add-expense")}
                >
                  <IconPlus size={16} />
                  <span>Add Expense</span>
                </button>
              )}
              {tab === "Vendors" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveModal("add-vendor")}
                >
                  <IconPlus size={16} />
                  <span>Add Vendor</span>
                </button>
              )}
              {tab === "Seasons" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveModal("add-season")}
                >
                  <IconPlus size={16} />
                  <span>New Seasonal Plan</span>
                </button>
              )}
            </div>
          </div>

          {/* ===================== OVERVIEW TAB ===================== */}
          {tab === "Overview" && (
            <div className="tab-pane animate-fade">
              {/* Primary Financial Metric Cards */}
              <div className="metric-grid-4">
                <div className="stat-card stat-emerald">
                  <div className="stat-card-header">
                    <span className="stat-title">Revenue Today</span>
                    <span className="stat-icon-wrapper green-icon">
                      <IconArrowUpRight size={16} />
                    </span>
                  </div>
                  <div className="stat-value">{rupees(salesToday)}</div>
                  <div className="stat-footnote">
                    <span className="pill-soft-green">
                      {todaySales.length} {todaySales.length === 1 ? "bill" : "bills"}
                    </span>
                    <span>recorded today</span>
                  </div>
                </div>

                <div className="stat-card stat-blue">
                  <div className="stat-card-header">
                    <span className="stat-title">Revenue MTD</span>
                    <span className="stat-icon-wrapper blue-icon">
                      <IconReports size={16} />
                    </span>
                  </div>
                  <div className="stat-value">{rupees(salesMtd)}</div>
                  <div className="stat-footnote">
                    <span>1st of {new Date().toLocaleString("en-IN", { month: "short" })} to today</span>
                  </div>
                </div>

                <div className="stat-card stat-purple">
                  <div className="stat-card-header">
                    <span className="stat-title">Revenue YTD</span>
                    <span className="stat-icon-wrapper purple-icon">
                      <IconReports size={16} />
                    </span>
                  </div>
                  <div className="stat-value">{rupees(salesYtd)}</div>
                  <div className="stat-footnote">
                    <span>Calendar Year {new Date().getFullYear()}</span>
                  </div>
                </div>

                <div className="stat-card stat-amber">
                  <div className="stat-card-header">
                    <span className="stat-title">Customer Dues (Udhaar)</span>
                    <span className="stat-icon-wrapper amber-icon">
                      <IconIndianRupee size={16} />
                    </span>
                  </div>
                  <div className="stat-value due-highlight">{rupees(dues)}</div>
                  <div className="stat-footnote">
                    <span className="pill-soft-amber">
                      {data.customers.filter((c) => balance(c.id) > 0).length} customers owe
                    </span>
                  </div>
                </div>
              </div>

              {/* Secondary Operational Metric Cards */}
              <div className="metric-grid-4 secondary-grid">
                <div className="stat-card mini">
                  <span className="stat-title">Gross Profit Today</span>
                  <div className="stat-value small-val">
                    {rupees(
                      todaySales.reduce((a, s) => a + s.total - s.cost * s.qty, 0)
                    )}
                  </div>
                  <small className="stat-hint">Sale revenue minus item cost</small>
                </div>

                <div className="stat-card mini">
                  <span className="stat-title">Stock Valuation</span>
                  <div className="stat-value small-val">{rupees(stockValue)}</div>
                  <small className="stat-hint">{data.products.length} catalog items</small>
                </div>

                <div className="stat-card mini">
                  <span className="stat-title">Units Stocked (MTD)</span>
                  <div className="stat-value small-val">{addedUnitsMonth} units</div>
                  <small className="stat-hint">{addedProductsMonth} new items registered</small>
                </div>

                <div className="stat-card mini">
                  <span className="stat-title">New Customers (MTD)</span>
                  <div className="stat-value small-val">
                    {currentMonthNewCustomers.length}
                  </div>
                  <small className="stat-hint">Registered this month</small>
                </div>
              </div>

              {/* Interactive Revenue Chart */}
              <section className="card-panel chart-box">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-heading">Revenue Trends & History</h3>
                    <p className="panel-subtext">
                      {period === "Year"
                        ? "Month-wise sales performance"
                        : period === "Month"
                        ? "Day-wise performance across selected month"
                        : "Hour-wise performance on chosen day"}
                    </p>
                  </div>

                  <div className="chart-pill-selector">
                    <div className="segmented-control">
                      {(["Year", "Month", "Day"] as const).map((p) => (
                        <button
                          key={p}
                          className={`segment-btn ${period === p ? "active" : ""}`}
                          onClick={() => setPeriod(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    {period === "Year" && (
                      <select
                        className="dropdown-input"
                        value={chartYear}
                        onChange={(e) => setChartYear(e.target.value)}
                      >
                        {Array.from({ length: 6 }, (_, i) =>
                          String(new Date().getFullYear() - i)
                        ).map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    )}

                    {period === "Month" && (
                      <input
                        type="month"
                        className="dropdown-input"
                        value={chartMonth}
                        onChange={(e) => setChartMonth(e.target.value)}
                      />
                    )}

                    {period === "Day" && (
                      <input
                        type="date"
                        className="dropdown-input"
                        value={chartDay}
                        onChange={(e) => setChartDay(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="chart-highlight-bar">
                  <span className="chart-total-label">Total for period:</span>
                  <strong className="chart-total-amount">{rupees(selectedChartTotal)}</strong>
                  {hoveredBar && (
                    <span className="chart-hover-pill">
                      {hoveredBar.label}: <b>{rupees(hoveredBar.value)}</b>
                    </span>
                  )}
                </div>

                <div className="modern-bar-chart">
                  {chartRows.map((r, i) => {
                    const pct = Math.round((r.value / maxChart) * 100);
                    return (
                      <div
                        className="chart-col"
                        key={r.label + i}
                        onMouseEnter={() => setHoveredBar(r)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        <span className="bar-hover-val">
                          {r.value > 0 ? (r.value > 9999 ? "₹" + Math.round(r.value / 1000) + "k" : rupees(r.value)) : ""}
                        </span>
                        <div className="bar-slot">
                          <div
                            className={`bar-fill ${r.value > 0 ? "has-value" : ""}`}
                            style={{ height: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                        <span className="bar-axis-label">
                          {period === "Year"
                            ? r.label
                            : period === "Month"
                            ? r.label
                            : i % 3 === 0
                            ? r.label
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Two Column Layout: Recent Sales & Low Stock Alerts */}
              <div className="grid-2-col">
                {/* Recent Sales Panel */}
                <section className="card-panel">
                  <div className="panel-header-row">
                    <div>
                      <h3 className="panel-heading">Recent Transactions</h3>
                      <p className="panel-subtext">Latest sales recorded in the ledger</p>
                    </div>
                    <button className="link-button" onClick={() => changeTab("Sales")}>
                      View all sales →
                    </button>
                  </div>

                  {data.sales.length > 0 ? (
                    <div className="compact-sales-list">
                      {data.sales.slice(0, 5).map((s) => (
                        <div className="transaction-row" key={s.id}>
                          <div className="tx-icon">
                            <IconSales size={16} />
                          </div>
                          <div className="tx-info">
                            <strong>{s.productName}</strong>
                            <span>
                              {s.customerName} • {s.qty} {s.qty === 1 ? "unit" : "units"}
                            </span>
                          </div>
                          <div className="tx-amount">
                            <strong>{rupees(s.total)}</strong>
                            <span
                              className={`status-pill ${
                                s.paid >= s.total ? "status-paid" : "status-due"
                              }`}
                            >
                              {s.paid >= s.total ? "Paid" : `Due ${rupees(s.total - s.paid)}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon-circle">
                        <IconSales size={24} />
                      </div>
                      <h4>No transactions yet</h4>
                      <p>Record your first customer sale to populate the ledger.</p>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setActiveModal("record-sale")}
                      >
                        ＋ Record Sale
                      </button>
                    </div>
                  )}
                </section>

                {/* Low Stock Alerts Panel */}
                <section className="card-panel">
                  <div className="panel-header-row">
                    <div className="with-badge">
                      <h3 className="panel-heading">Needs Attention</h3>
                      {low.length > 0 && <span className="warning-count-badge">{low.length}</span>}
                    </div>
                    <button className="link-button" onClick={() => changeTab("Inventory")}>
                      Inventory →
                    </button>
                  </div>
                  <p className="panel-subtext" style={{ marginTop: -10, marginBottom: 16 }}>
                    Items running below their low-stock thresholds
                  </p>

                  {low.length > 0 ? (
                    <div className="alert-items-list">
                      {low.slice(0, 5).map((p) => (
                        <div className="alert-item-card" key={p.id}>
                          <div className="alert-icon-wrap">
                            <IconAlertTriangle size={16} />
                          </div>
                          <div className="alert-item-details">
                            <strong>{p.name}</strong>
                            <span className="alert-item-meta">
                              Stock remaining: <b className="danger-text">{p.stock} units</b>{" "}
                              (Threshold: {p.threshold})
                            </span>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openRestockFor(p.id)}
                          >
                            Restock
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon-circle green">
                        <IconCheckCircle size={24} />
                      </div>
                      <h4>All items in stock</h4>
                      <p>None of your inventory items are currently below low-stock thresholds.</p>
                    </div>
                  )}
                </section>
              </div>

              {/* Quick Actions Bar */}
              <section className="card-panel quick-dock-card">
                <div className="quick-dock-header">
                  <h3>Quick Actions</h3>
                  <p>Frequently used tasks for your everyday shop routine.</p>
                </div>
                <div className="quick-action-grid">
                  <button
                    className="action-card-btn"
                    onClick={() => setActiveModal("record-sale")}
                  >
                    <div className="action-circle-icon green-icon">
                      <IconSales size={20} />
                    </div>
                    <strong>Record Sale</strong>
                    <span>Cash or credit sale</span>
                  </button>

                  <button
                    className="action-card-btn"
                    onClick={() => setActiveModal("add-product")}
                  >
                    <div className="action-circle-icon blue-icon">
                      <IconPlus size={20} />
                    </div>
                    <strong>Add Product</strong>
                    <span>Catalog new stock</span>
                  </button>

                  <button
                    className="action-card-btn"
                    onClick={() => setActiveModal("collect-payment")}
                  >
                    <div className="action-circle-icon amber-icon">
                      <IconIndianRupee size={20} />
                    </div>
                    <strong>Collect Udhaar</strong>
                    <span>Record payment</span>
                  </button>

                  <button
                    className="action-card-btn"
                    onClick={() => setActiveModal("add-expense")}
                  >
                    <div className="action-circle-icon purple-icon">
                      <IconExpenses size={20} />
                    </div>
                    <strong>Add Expense</strong>
                    <span>Rent, utility, bill</span>
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ===================== INVENTORY TAB ===================== */}
          {tab === "Inventory" && (
            <div className="tab-pane animate-fade">
              {/* Toolbar */}
              <div className="modern-toolbar">
                <div className="toolbar-info">
                  <div className="info-badge">
                    <strong>{data.products.length} Products</strong>
                    <span>in catalog</span>
                  </div>
                  <div className="info-badge">
                    <strong>{addedUnitsMonth} Units</strong>
                    <span>added this month</span>
                  </div>
                  {low.length > 0 && (
                    <div className="info-badge warning">
                      <strong>{low.length} Low Stock</strong>
                      <span>needs reorder</span>
                    </div>
                  )}
                </div>

                <div className="toolbar-btn-group">
                  <button className="btn btn-secondary btn-sm" onClick={weeklyOverview}>
                    <IconDownload size={14} />
                    <span>Weekly Review CSV</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={productOverview}>
                    <IconDownload size={14} />
                    <span>Full Catalog CSV</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-product")}
                  >
                    <IconPlus size={14} />
                    <span>New Product</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="filter-shelf">
                <div className="search-bar-input-wrap">
                  <IconSearch size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by product name, SKU or category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-text-field"
                  />
                  {search && (
                    <button
                      className="clear-search-btn"
                      onClick={() => setSearch("")}
                      title="Clear search"
                    >
                      <IconClose size={14} />
                    </button>
                  )}
                </div>

                {/* Category & Low Stock Filter Chips */}
                <div className="chips-scroll-row">
                  {productCategories.map((cat) => (
                    <button
                      key={cat}
                      className={`filter-chip ${categoryFilter === cat ? "active" : ""}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    className={`filter-chip warning-chip ${lowStockOnly ? "active" : ""}`}
                    onClick={() => setLowStockOnly((v) => !v)}
                  >
                    <IconAlertTriangle size={13} />
                    <span>Low Stock Only ({low.length})</span>
                  </button>
                </div>
              </div>

              {/* PRODUCTS DISPLAY: MOBILE ADAPTIVE CARDS + DESKTOP TABLE */}
              {products.length > 0 ? (
                <>
                  {/* Mobile & Tablet Card View */}
                  <div className="mobile-product-cards-grid">
                    {products.map((p) => {
                      const isLow = p.stock <= p.threshold;
                      const marginPct =
                        p.cost > 0
                          ? Math.round(((p.price - p.cost) / p.cost) * 100)
                          : 0;
                      return (
                        <div className={`product-card ${isLow ? "border-alert" : ""}`} key={p.id}>
                          <div className="product-card-top">
                            <div>
                              <span className="product-category-tag">{p.category}</span>
                              <h4 className="product-card-name">{p.name}</h4>
                              <span className="product-card-sku">{p.sku || "No SKU"}</span>
                            </div>
                            <span className={`stock-status-tag ${isLow ? "low" : "ok"}`}>
                              {isLow ? `⚠️ ${p.stock} left` : `✓ ${p.stock} in stock`}
                            </span>
                          </div>

                          <div className="product-pricing-box">
                            <div className="price-item">
                              <span className="price-label">Cost</span>
                              <strong>{rupees(p.cost)}</strong>
                            </div>
                            <div className="price-arrow">→</div>
                            <div className="price-item">
                              <span className="price-label">Selling</span>
                              <strong className="selling-price">{rupees(p.price)}</strong>
                            </div>
                            {marginPct !== 0 && (
                              <span className="margin-pill">+{marginPct}%</span>
                            )}
                          </div>

                          <div className="product-card-footer">
                            <button
                              className="btn btn-secondary btn-sm flex-1"
                              onClick={() => openRestockFor(p.id)}
                            >
                              Restock
                            </button>
                            <button
                              className="btn btn-primary btn-sm flex-1"
                              onClick={() => openSaleFor(p.id)}
                              disabled={p.stock <= 0}
                            >
                              Sell ↗
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="desktop-table-container card-panel">
                    <div className="table-responsive">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>PRODUCT</th>
                            <th>CATEGORY</th>
                            <th>COST PRICE</th>
                            <th>SELLING PRICE</th>
                            <th>CURRENT STOCK</th>
                            <th>STATUS</th>
                            <th style={{ textAlign: "right" }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => {
                            const isLow = p.stock <= p.threshold;
                            return (
                              <tr key={p.id}>
                                <td>
                                  <div className="table-item-title">{p.name}</div>
                                  <small className="table-item-sub">{p.sku || "No SKU"}</small>
                                </td>
                                <td>
                                  <span className="table-pill">{p.category}</span>
                                </td>
                                <td>{rupees(p.cost)}</td>
                                <td>
                                  <b>{rupees(p.price)}</b>
                                </td>
                                <td>
                                  <span className={isLow ? "danger-text font-bold" : ""}>
                                    {p.stock} units
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`status-pill ${
                                      isLow ? "status-due" : "status-paid"
                                    }`}
                                  >
                                    {isLow ? "Low Stock" : "In Stock"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div className="table-action-btns">
                                    <button
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => openRestockFor(p.id)}
                                      title="Restock this item"
                                    >
                                      Restock
                                    </button>
                                    <button
                                      className="btn btn-primary btn-xs"
                                      onClick={() => openSaleFor(p.id)}
                                      disabled={p.stock <= 0}
                                      title="Sell this item"
                                    >
                                      Sell
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state card-panel">
                  <div className="empty-icon-circle">
                    <IconInventory size={24} />
                  </div>
                  <h4>No products found</h4>
                  <p>
                    {search || categoryFilter !== "All" || lowStockOnly
                      ? "No products matched your active search or filters."
                      : "Start by cataloging your shop products."}
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-product")}
                  >
                    ＋ Add First Product
                  </button>
                </div>
              )}

              {/* Stock Movement Register */}
              <div className="card-panel mt-6">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-heading">Stock Movement History</h3>
                    <p className="panel-subtext">Dated record of opening stock and supplier purchases</p>
                  </div>
                </div>

                {data.stockMoves.length > 0 ? (
                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>ITEM</th>
                          <th>TYPE</th>
                          <th>QUANTITY</th>
                          <th>UNIT COST</th>
                          <th>TOTAL COST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.stockMoves.slice(0, 15).map((m) => (
                          <tr key={m.id}>
                            <td>{dateText(m.date)}</td>
                            <td>
                              <b>{m.productName}</b>
                            </td>
                            <td>
                              <span
                                className={`type-badge ${
                                  m.kind === "opening" ? "type-open" : "type-purchase"
                                }`}
                              >
                                {m.kind === "opening" ? "Opening Stock" : "Purchase"}
                              </span>
                            </td>
                            <td>
                              <b>+{m.qty}</b>
                            </td>
                            <td>{rupees(m.unitCost)}</td>
                            <td>
                              <b>{rupees(m.qty * m.unitCost)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No stock movement entries recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== SALES TAB ===================== */}
          {tab === "Sales" && (
            <div className="tab-pane animate-fade">
              {/* Sales Toolbar */}
              <div className="modern-toolbar">
                <div className="toolbar-info">
                  <div className="info-badge">
                    <strong>{data.sales.length} Transactions</strong>
                    <span>recorded in total</span>
                  </div>
                  <div className="info-badge">
                    <strong>{rupees(salesMtd)}</strong>
                    <span>Month-to-date sales</span>
                  </div>
                </div>

                <div className="toolbar-btn-group">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      downloadCsv(
                        "dukaan-sales-" + today() + ".csv",
                        [
                          [
                            "Sale ID",
                            "Date",
                            "Item",
                            "Customer",
                            "Quantity",
                            "Total (INR)",
                            "Paid (INR)",
                            "Due (INR)",
                          ],
                          ...data.sales.map((s) => [
                            s.id,
                            s.date,
                            s.productName,
                            s.customerName,
                            s.qty,
                            s.total / 100,
                            s.paid / 100,
                            (s.total - s.paid) / 100,
                          ]),
                        ]
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>Download Sales CSV</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("record-sale")}
                  >
                    <IconPlus size={14} />
                    <span>Record Sale</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="filter-shelf">
                <div className="search-bar-input-wrap">
                  <IconSearch size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by customer name or product..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-text-field"
                  />
                  {search && (
                    <button className="clear-search-btn" onClick={() => setSearch("")}>
                      <IconClose size={14} />
                    </button>
                  )}
                </div>

                <div className="chips-scroll-row">
                  {(["All", "Paid", "Due"] as const).map((st) => (
                    <button
                      key={st}
                      className={`filter-chip ${salesStatusFilter === st ? "active" : ""}`}
                      onClick={() => setSalesStatusFilter(st)}
                    >
                      {st === "All" ? "All Sales" : st === "Paid" ? "Fully Paid" : "Has Due (Credit)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* SALES CONTENT: MOBILE CARDS + DESKTOP TABLE */}
              {filteredSales.length > 0 ? (
                <>
                  {/* Mobile Sales Cards */}
                  <div className="mobile-sales-cards-grid">
                    {filteredSales.map((s) => {
                      const isDue = s.paid < s.total;
                      return (
                        <div className={`sales-card ${isDue ? "border-due" : ""}`} key={s.id}>
                          <div className="sales-card-top">
                            <div>
                              <strong className="sales-card-title">{s.productName}</strong>
                              <span className="sales-card-meta">
                                {s.customerName} • {s.qty} {s.qty === 1 ? "unit" : "units"}
                              </span>
                            </div>
                            <div className="sales-card-total">
                              <strong>{rupees(s.total)}</strong>
                              <span className="sales-date">{dateText(s.date)}</span>
                            </div>
                          </div>

                          <div className="sales-card-footer">
                            <span className="sales-paid-tag">Paid: {rupees(s.paid)}</span>
                            {isDue ? (
                              <span className="status-pill status-due">
                                Due: {rupees(s.total - s.paid)}
                              </span>
                            ) : (
                              <span className="status-pill status-paid">Paid in Full</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="desktop-table-container card-panel">
                    <div className="table-responsive">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>ITEM</th>
                            <th>CUSTOMER</th>
                            <th>DATE</th>
                            <th>QTY</th>
                            <th>TOTAL BILL</th>
                            <th>PAID</th>
                            <th>DUE BALANCE</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSales.map((s) => {
                            const isDue = s.paid < s.total;
                            return (
                              <tr key={s.id}>
                                <td>
                                  <b>{s.productName}</b>
                                </td>
                                <td>{s.customerName}</td>
                                <td>{dateText(s.date)}</td>
                                <td>{s.qty}</td>
                                <td>
                                  <b>{rupees(s.total)}</b>
                                </td>
                                <td>{rupees(s.paid)}</td>
                                <td className={isDue ? "due-highlight font-bold" : ""}>
                                  {isDue ? rupees(s.total - s.paid) : "₹0"}
                                </td>
                                <td>
                                  <span
                                    className={`status-pill ${
                                      isDue ? "status-due" : "status-paid"
                                    }`}
                                  >
                                    {isDue ? "Credit (Due)" : "Paid"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state card-panel">
                  <div className="empty-icon-circle">
                    <IconSales size={24} />
                  </div>
                  <h4>No sales records found</h4>
                  <p>
                    {search || salesStatusFilter !== "All"
                      ? "No sales match your current search criteria."
                      : "Record your first shop sale to start tracking ledger revenue."}
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("record-sale")}
                  >
                    ＋ Record Sale
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===================== CUSTOMERS TAB ===================== */}
          {tab === "Customers" && (
            <div className="tab-pane animate-fade">
              {/* Toolbar */}
              <div className="modern-toolbar">
                <div className="toolbar-info">
                  <div className="info-badge">
                    <strong>{data.customers.length} Customers</strong>
                    <span>registered in directory</span>
                  </div>
                  <div className="info-badge">
                    <strong>{lastMonthCustomers.length} Added</strong>
                    <span>last month</span>
                  </div>
                  {dues > 0 && (
                    <div className="info-badge warning">
                      <strong>{rupees(dues)} Total Due</strong>
                      <span>across customers</span>
                    </div>
                  )}
                </div>

                <div className="toolbar-btn-group">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      downloadCsv(
                        "dukaan-new-customers-" + lastMonth + ".csv",
                        [
                          ["Name", "Phone", "Added on"],
                          ...lastMonthCustomers.map((c) => [
                            c.name,
                            c.phone,
                            dateText(c.createdAt || ""),
                          ]),
                        ]
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>Last Month's List CSV</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-customer")}
                  >
                    <IconPlus size={14} />
                    <span>New Customer</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveModal("collect-payment")}
                  >
                    <IconIndianRupee size={14} />
                    <span>Collect Payment</span>
                  </button>
                </div>
              </div>

              {/* Search & Due Filter Chips */}
              <div className="filter-shelf">
                <div className="search-bar-input-wrap">
                  <IconSearch size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-text-field"
                  />
                  {search && (
                    <button className="clear-search-btn" onClick={() => setSearch("")}>
                      <IconClose size={14} />
                    </button>
                  )}
                </div>

                <div className="chips-scroll-row">
                  {(["All", "Due", "Settled"] as const).map((flt) => (
                    <button
                      key={flt}
                      className={`filter-chip ${customerDueFilter === flt ? "active" : ""}`}
                      onClick={() => setCustomerDueFilter(flt)}
                    >
                      {flt === "All"
                        ? "All Customers"
                        : flt === "Due"
                        ? "Has Udhaar / Due"
                        : "Account Cleared"}
                    </button>
                  ))}
                </div>
              </div>

              {/* CUSTOMERS VIEW: MOBILE CARDS + DESKTOP TABLE */}
              {customers.length > 0 ? (
                <>
                  {/* Mobile Customer Cards */}
                  <div className="mobile-customer-cards-grid">
                    {customers.map((c) => {
                      const bal = balance(c.id);
                      const customerSales = data.sales.filter((s) => s.customerId === c.id);
                      const totalPurchased = customerSales.reduce((a, s) => a + s.total, 0);
                      return (
                        <div className={`customer-card ${bal > 0 ? "border-due" : ""}`} key={c.id}>
                          <div className="customer-card-header">
                            <div className="customer-avatar-badge">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="customer-info-box">
                              <h4 className="customer-name">{c.name}</h4>
                              <div className="customer-phone-row">
                                {c.phone ? (
                                  <a href={`tel:${c.phone}`} className="phone-link">
                                    <IconPhone size={13} />
                                    <span>{c.phone}</span>
                                  </a>
                                ) : (
                                  <span className="no-phone">No phone</span>
                                )}
                                <span className="join-date">• Added {dateText(c.createdAt || "")}</span>
                              </div>
                            </div>
                          </div>

                          <div className="customer-stats-shelf">
                            <div className="cust-stat">
                              <span>Orders</span>
                              <b>{customerSales.length}</b>
                            </div>
                            <div className="cust-stat">
                              <span>Total Bought</span>
                              <b>{rupees(totalPurchased)}</b>
                            </div>
                            <div className="cust-stat highlight">
                              <span>Balance Due</span>
                              <b className={bal > 0 ? "due-highlight" : "green-text"}>
                                {bal > 0 ? rupees(bal) : "✓ Clear"}
                              </b>
                            </div>
                          </div>

                          <div className="customer-card-actions">
                            {bal > 0 && (
                              <button
                                className="btn btn-primary btn-sm flex-1"
                                onClick={() => openCollectFor(c.id)}
                              >
                                Collect Payment ({rupees(bal)})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table */}
                  <div className="desktop-table-container card-panel">
                    <div className="table-responsive">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>CUSTOMER</th>
                            <th>PHONE</th>
                            <th>TOTAL PURCHASES</th>
                            <th>TOTAL SPENT</th>
                            <th>AMOUNT PAID</th>
                            <th>OUTSTANDING BALANCE</th>
                            <th style={{ textAlign: "right" }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customers.map((c) => {
                            const bal = balance(c.id);
                            const customerSales = data.sales.filter(
                              (s) => s.customerId === c.id
                            );
                            const totalSpent = customerSales.reduce((a, s) => a + s.total, 0);
                            const totalPaid = customerSales.reduce((a, s) => a + s.paid, 0);
                            return (
                              <tr key={c.id}>
                                <td>
                                  <b>{c.name}</b>
                                  <small className="block-subtext">
                                    Added {dateText(c.createdAt || "")}
                                  </small>
                                </td>
                                <td>
                                  {c.phone ? (
                                    <a href={`tel:${c.phone}`} className="phone-table-link">
                                      <IconPhone size={12} />
                                      <span>{c.phone}</span>
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>{customerSales.length} orders</td>
                                <td>{rupees(totalSpent)}</td>
                                <td>{rupees(totalPaid)}</td>
                                <td className={bal > 0 ? "due-highlight font-bold" : ""}>
                                  {bal > 0 ? rupees(bal) : "✓ Settled"}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {bal > 0 ? (
                                    <button
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => openCollectFor(c.id)}
                                    >
                                      Collect ₹
                                    </button>
                                  ) : (
                                    <span className="settled-tag">Clear</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state card-panel">
                  <div className="empty-icon-circle">
                    <IconCustomers size={24} />
                  </div>
                  <h4>No customers found</h4>
                  <p>
                    {search || customerDueFilter !== "All"
                      ? "No customers matched your filter settings."
                      : "Add your regular shop customers to manage credit and payments."}
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-customer")}
                  >
                    ＋ Add Customer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===================== VENDORS TAB ===================== */}
          {tab === "Vendors" && (
            <div className="tab-pane animate-fade">
              <div className="modern-toolbar">
                <div className="toolbar-info">
                  <div className="info-badge">
                    <strong>{data.vendors.length} Vendors</strong>
                    <span>registered</span>
                  </div>
                  <div className="info-badge">
                    <strong>{data.purchases.length} Purchase Orders</strong>
                    <span>recorded</span>
                  </div>
                </div>

                <div className="toolbar-btn-group">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-vendor")}
                  >
                    <IconPlus size={14} />
                    <span>Add Vendor</span>
                  </button>
                </div>
              </div>

              <div className="filter-shelf">
                <div className="search-bar-input-wrap">
                  <IconSearch size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search vendors by name or category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-text-field"
                  />
                  {search && (
                    <button className="clear-search-btn" onClick={() => setSearch("")}>
                      <IconClose size={14} />
                    </button>
                  )}
                </div>
              </div>

              {vendors.length > 0 ? (
                <div className="desktop-table-container card-panel">
                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>VENDOR / SUPPLIER</th>
                          <th>SUPPLIES / CATEGORY</th>
                          <th>PHONE</th>
                          <th>TOTAL ORDERS</th>
                          <th>TOTAL SPEND</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendors.map((v) => {
                          const buys = data.purchases.filter((p) => p.vendorId === v.id);
                          const totalSpend = buys.reduce((a, p) => a + p.total, 0);
                          return (
                            <tr key={v.id}>
                              <td>
                                <b>{v.name}</b>
                                <small className="block-subtext">
                                  Joined {dateText(v.createdAt)}
                                </small>
                              </td>
                              <td>
                                <span className="table-pill">{v.category}</span>
                              </td>
                              <td>{v.phone || "—"}</td>
                              <td>{buys.length} orders</td>
                              <td>
                                <b>{rupees(totalSpend)}</b>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state card-panel">
                  <div className="empty-icon-circle">
                    <IconVendors size={24} />
                  </div>
                  <h4>No vendors registered</h4>
                  <p>Add the wholesale vendors you regularly purchase stock from.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-vendor")}
                  >
                    ＋ Add First Vendor
                  </button>
                </div>
              )}

              {/* Purchase History */}
              {data.purchases.length > 0 && (
                <div className="card-panel mt-6">
                  <div className="panel-header-row">
                    <div>
                      <h3 className="panel-heading">Purchase Register</h3>
                      <p className="panel-subtext">Recent inventory supply invoices</p>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>VENDOR</th>
                          <th>PRODUCT</th>
                          <th>QTY</th>
                          <th>UNIT COST</th>
                          <th>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.purchases.slice(0, 10).map((p) => (
                          <tr key={p.id}>
                            <td>{dateText(p.date)}</td>
                            <td>
                              <b>{p.vendorName}</b>
                            </td>
                            <td>{p.productName}</td>
                            <td>+{p.qty}</td>
                            <td>{rupees(p.unitCost)}</td>
                            <td>
                              <b>{rupees(p.total)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== EXPENSES TAB ===================== */}
          {tab === "Expenses" && (
            <div className="tab-pane animate-fade">
              <div className="modern-toolbar">
                <div className="toolbar-info">
                  <div className="info-badge">
                    <strong>{data.expenses.length} Records</strong>
                    <span>logged</span>
                  </div>
                  <div className="info-badge">
                    <strong>{rupees(monthExpenses)}</strong>
                    <span>Expenses this month</span>
                  </div>
                </div>

                <div className="toolbar-btn-group">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-expense")}
                  >
                    <IconPlus size={14} />
                    <span>Record Expense</span>
                  </button>
                </div>
              </div>

              {data.expenses.length > 0 ? (
                <div className="desktop-table-container card-panel">
                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>EXPENSE TITLE</th>
                          <th>CATEGORY</th>
                          <th>DATE</th>
                          <th>AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.expenses.map((e) => (
                          <tr key={e.id}>
                            <td>
                              <b>{e.title}</b>
                            </td>
                            <td>
                              <span className="table-pill">{e.category}</span>
                            </td>
                            <td>{dateText(e.date)}</td>
                            <td>
                              <b className="expense-text">{rupees(e.amount)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state card-panel">
                  <div className="empty-icon-circle">
                    <IconExpenses size={24} />
                  </div>
                  <h4>No shop expenses recorded</h4>
                  <p>Track rent, utility bills, maintenance, transport, and staff costs.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-expense")}
                  >
                    ＋ Record First Expense
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===================== REPORTS TAB ===================== */}
          {tab === "Reports" && (
            <div className="tab-pane animate-fade">
              <div className="metric-grid-4">
                <div className="stat-card stat-emerald">
                  <span className="stat-title">Revenue Today</span>
                  <div className="stat-value">{rupees(salesToday)}</div>
                  <small className="stat-hint">{todaySales.length} transactions</small>
                </div>
                <div className="stat-card stat-blue">
                  <span className="stat-title">Revenue MTD</span>
                  <div className="stat-value">{rupees(salesMtd)}</div>
                  <small className="stat-hint">Month-to-date sales</small>
                </div>
                <div className="stat-card stat-purple">
                  <span className="stat-title">Revenue YTD</span>
                  <div className="stat-value">{rupees(salesYtd)}</div>
                  <small className="stat-hint">Year-to-date total</small>
                </div>
                <div className="stat-card stat-amber">
                  <span className="stat-title">Estimated Net Profit MTD</span>
                  <div className="stat-value" style={{ color: profitMtd >= 0 ? "var(--emerald)" : "var(--rose)" }}>
                    {rupees(profitMtd)}
                  </div>
                  <small className="stat-hint">Sales − (COGS + Expenses)</small>
                </div>
              </div>

              {/* Monthly Financial Breakdown Card */}
              <section className="card-panel financial-breakdown-card mt-6">
                <h3 className="panel-heading">Monthly Financial P&L Statement</h3>
                <p className="panel-subtext">Estimated Net Profit for the current calendar month</p>

                <div className="pnl-statement">
                  <div className="pnl-row">
                    <span>Revenue (MTD)</span>
                    <strong className="green-text">+{rupees(salesMtd)}</strong>
                  </div>
                  <div className="pnl-row">
                    <span>Cost of Goods Sold (COGS)</span>
                    <strong className="rose-text">−{rupees(monthCogs)}</strong>
                  </div>
                  <div className="pnl-row">
                    <span>Shop Expenses (MTD)</span>
                    <strong className="rose-text">−{rupees(monthExpenses)}</strong>
                  </div>
                  <div className="pnl-divider" />
                  <div className="pnl-row net-row">
                    <div>
                      <strong>Estimated Net Profit (MTD)</strong>
                      <small className="block-subtext">Gross Margin − Overhead Expenses</small>
                    </div>
                    <span className={`net-profit-badge ${profitMtd >= 0 ? "positive" : "negative"}`}>
                      {rupees(profitMtd)}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ===================== SEASONS TAB ===================== */}
          {tab === "Seasons" && (
            <div className="tab-pane animate-fade">
              <div className="season-hero-banner">
                <div className="season-hero-text">
                  <h3>Seasonal Inventory Planning</h3>
                  <p>
                    Plan seasonal peak demand in advance (e.g. Diwali crackers, Holi colors, Summer
                    drinks).
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveModal("add-season")}
                >
                  <IconPlus size={14} />
                  <span>New Seasonal Plan</span>
                </button>
              </div>

              {data.seasons.length > 0 ? (
                <div className="season-cards-grid">
                  {data.seasons.map((s) => {
                    const isActive = activeSeasons.some((x) => x.id === s.id);
                    return (
                      <div
                        className={`season-plan-card ${isActive ? "active-season" : ""}`}
                        key={s.id}
                      >
                        <div className="season-card-top">
                          <div>
                            <h4>{s.name}</h4>
                            <span className="season-months-badge">
                              {new Date(2020, s.startMonth - 1).toLocaleDateString("en-IN", {
                                month: "short",
                              })}{" "}
                              –{" "}
                              {new Date(2020, s.endMonth - 1).toLocaleDateString("en-IN", {
                                month: "short",
                              })}
                            </span>
                          </div>
                          <span className={`status-pill ${isActive ? "status-paid" : ""}`}>
                            {isActive ? "Active Now" : "Planned"}
                          </span>
                        </div>

                        {s.notes && <p className="season-notes">{s.notes}</p>}

                        <div className="season-linked-items-shelf">
                          <span className="linked-title">Linked Products:</span>
                          <div className="chips-scroll-row">
                            {s.productIds.length > 0 ? (
                              s.productIds.map((id) => {
                                const prod = data.products.find((p) => p.id === id);
                                return prod ? (
                                  <span className="product-mini-pill" key={id}>
                                    {prod.name}
                                  </span>
                                ) : null;
                              })
                            ) : (
                              <span className="no-items">No products linked</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state card-panel">
                  <div className="empty-icon-circle">
                    <IconSeasons size={24} />
                  </div>
                  <h4>No seasonal plans created</h4>
                  <p>Group festive and seasonal items to forecast demand and restock ahead of time.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveModal("add-season")}
                  >
                    ＋ Create Seasonal Plan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FOOTER */}
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} Dukaan Ledger • All data stored locally in your browser.</span>
            <div className="footer-links">
              <button className="text-link" onClick={loadDemoData}>
                Load Demo Data
              </button>
              <span>•</span>
              <button className="text-link" onClick={productOverview}>
                Export Catalog CSV
              </button>
            </div>
          </footer>
        </div>
      </main>

      {/* FLOATING ACTION BUTTON (FAB) FOR PHONES */}
      <div className="mobile-fab-container">
        <button
          className="fab-button"
          onClick={() => setActiveModal("quick-menu")}
          aria-label="Quick Actions"
        >
          <IconPlus size={22} />
        </button>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        {mobilePrimaryTabs.map((t) => (
          <button
            key={t}
            className={`bottom-nav-item ${tab === t ? "active" : ""}`}
            onClick={() => changeTab(t)}
          >
            <span className="bottom-nav-icon">
              {t === "Overview" && <IconOverview />}
              {t === "Inventory" && <IconInventory />}
              {t === "Sales" && <IconSales />}
              {t === "Customers" && <IconCustomers />}
              {t === "Inventory" && low.length > 0 ? (
                <span className="dot-badge" />
              ) : null}
            </span>
            <span className="bottom-nav-label">{t === "Overview" ? "Home" : t}</span>
          </button>
        ))}

        {/* More Tab Trigger */}
        <button
          className={`bottom-nav-item ${
            ["Vendors", "Expenses", "Reports", "Seasons"].includes(tab) ? "active" : ""
          }`}
          onClick={() => setActiveModal("more-menu")}
        >
          <span className="bottom-nav-icon">
            <IconMore size={20} />
          </span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>

      {/* TOAST NOTIFICATION */}
      {notice && (
        <div className="app-toast-alert animate-slide-up">
          <div className="toast-content">{notice}</div>
        </div>
      )}

      {/* ===================== MODAL DIALOGS / BOTTOM SHEETS ===================== */}

      {/* 1. QUICK ACTIONS MENU SHEET */}
      {activeModal === "quick-menu" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>Quick Actions</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <div className="sheet-actions-grid">
              <button
                className="sheet-action-item"
                onClick={() => setActiveModal("record-sale")}
              >
                <div className="action-circle-icon green-icon">
                  <IconSales size={20} />
                </div>
                <strong>Record Sale</strong>
                <span>Cash or credit bill</span>
              </button>
              <button
                className="sheet-action-item"
                onClick={() => setActiveModal("add-product")}
              >
                <div className="action-circle-icon blue-icon">
                  <IconPlus size={20} />
                </div>
                <strong>Add Product</strong>
                <span>New inventory item</span>
              </button>
              <button
                className="sheet-action-item"
                onClick={() => setActiveModal("collect-payment")}
              >
                <div className="action-circle-icon amber-icon">
                  <IconIndianRupee size={20} />
                </div>
                <strong>Collect Udhaar</strong>
                <span>Receive customer due</span>
              </button>
              <button
                className="sheet-action-item"
                onClick={() => setActiveModal("restock")}
              >
                <div className="action-circle-icon purple-icon">
                  <IconInventory size={20} />
                </div>
                <strong>Stock Up</strong>
                <span>Record vendor purchase</span>
              </button>
              <button
                className="sheet-action-item"
                onClick={() => setActiveModal("add-expense")}
              >
                <div className="action-circle-icon rose-icon">
                  <IconExpenses size={20} />
                </div>
                <strong>Add Expense</strong>
                <span>Utilities, rent, etc.</span>
              </button>
              <button
                className="sheet-action-item"
                onClick={() => setActiveModal("add-customer")}
              >
                <div className="action-circle-icon blue-icon">
                  <IconCustomers size={20} />
                </div>
                <strong>Add Customer</strong>
                <span>Register new client</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MORE MENU DRAWER */}
      {activeModal === "more-menu" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>More Modules</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <div className="more-menu-list">
              <button
                className="more-menu-row"
                onClick={() => changeTab("Vendors")}
              >
                <div className="menu-icon-wrap">
                  <IconVendors size={18} />
                </div>
                <div>
                  <strong>Vendors & Suppliers</strong>
                  <span>Manage wholesale vendors and invoices</span>
                </div>
              </button>
              <button
                className="more-menu-row"
                onClick={() => changeTab("Expenses")}
              >
                <div className="menu-icon-wrap">
                  <IconExpenses size={18} />
                </div>
                <div>
                  <strong>Shop Expenses</strong>
                  <span>Track rent, electricity, transport, bills</span>
                </div>
              </button>
              <button
                className="more-menu-row"
                onClick={() => changeTab("Reports")}
              >
                <div className="menu-icon-wrap">
                  <IconReports size={18} />
                </div>
                <div>
                  <strong>Financial Reports & P&L</strong>
                  <span>Net profit, COGS, and sales performance</span>
                </div>
              </button>
              <button
                className="more-menu-row"
                onClick={() => changeTab("Seasons")}
              >
                <div className="menu-icon-wrap">
                  <IconSeasons size={18} />
                </div>
                <div>
                  <strong>Seasonal Plans</strong>
                  <span>Festive demand and seasonal cataloging</span>
                </div>
              </button>

              <div className="more-menu-divider" />

              <div className="more-menu-actions">
                <button className="btn btn-secondary btn-sm flex-1" onClick={productOverview}>
                  <IconDownload size={14} />
                  <span>Download Inventory CSV</span>
                </button>
                <button className="btn btn-secondary btn-sm flex-1" onClick={loadDemoData}>
                  <IconSparkles size={14} />
                  <span>Load Sample Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADD PRODUCT MODAL */}
      {activeModal === "add-product" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add New Product</h3>
                <p>Register item to inventory catalogue</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addProduct} className="modal-form">
              <Field
                label="Product Name"
                value={pform.name}
                onChange={(v) => setPform((f) => ({ ...f, name: v }))}
                required
                placeholder="e.g. Basmati Rice (5 kg)"
                autoFocus
              />
              <div className="form-grid-2">
                <Field
                  label="Category"
                  value={pform.category}
                  onChange={(v) => setPform((f) => ({ ...f, category: v }))}
                  required
                  placeholder="e.g. Grocery, Vegetables"
                />
                <Field
                  label="SKU / Barcode"
                  value={pform.sku}
                  onChange={(v) => setPform((f) => ({ ...f, sku: v }))}
                  placeholder="e.g. GRC-001"
                />
              </div>
              <div className="form-grid-2">
                <Field
                  label="Cost Price (₹)"
                  type="number"
                  value={pform.cost}
                  onChange={(v) => setPform((f) => ({ ...f, cost: v }))}
                  required
                  placeholder="Purchase cost"
                />
                <Field
                  label="Default Selling Price (₹)"
                  type="number"
                  value={pform.price}
                  onChange={(v) => setPform((f) => ({ ...f, price: v }))}
                  required
                  placeholder="Selling rate"
                />
              </div>
              <div className="form-grid-2">
                <Field
                  label="Opening Stock Qty"
                  type="number"
                  value={pform.stock}
                  onChange={(v) => setPform((f) => ({ ...f, stock: v }))}
                  placeholder="Initial stock"
                />
                <Field
                  label="Low Stock Alert Threshold"
                  type="number"
                  value={pform.threshold}
                  onChange={(v) => setPform((f) => ({ ...f, threshold: v }))}
                  placeholder="Alert at"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RECORD SALE MODAL */}
      {activeModal === "record-sale" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Record Sale</h3>
                <p>Generate customer bill and update stock</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addSale} className="modal-form">
              <label className="field">
                <span className="field-label">
                  Select Product <em className="required-mark">*</em>
                </span>
                <select
                  required
                  className="field-input"
                  value={sform.product}
                  onChange={(e) => {
                    const prod = data.products.find((x) => x.id === e.target.value);
                    setSform((f) => ({
                      ...f,
                      product: e.target.value,
                      selling: prod ? String(prod.price / 100) : "",
                      paid:
                        prod && f.qty
                          ? String((prod.price / 100) * Number(f.qty))
                          : "",
                    }));
                  }}
                >
                  <option value="">-- Choose item --</option>
                  {data.products
                    .filter((p) => p.stock > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} • {p.stock} available (Default: {rupees(p.price)})
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Customer (Required for credit sales)</span>
                <select
                  className="field-input"
                  value={sform.customer}
                  onChange={(e) => setSform((f) => ({ ...f, customer: e.target.value }))}
                >
                  <option value="">Walk-in Customer (Full cash payment)</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid-2">
                <Field
                  label="Quantity"
                  type="number"
                  value={sform.qty}
                  onChange={(v) => {
                    setSform((f) => {
                      const totalCents = Number(f.selling || 0) * Number(v || 1);
                      return { ...f, qty: v, paid: String(totalCents) };
                    });
                  }}
                  required
                />
                <Field
                  label="Selling Rate for this sale (₹)"
                  type="number"
                  value={sform.selling}
                  onChange={(v) => {
                    setSform((f) => {
                      const totalCents = Number(v || 0) * Number(f.qty || 1);
                      return { ...f, selling: v, paid: String(totalCents) };
                    });
                  }}
                  required
                />
              </div>

              {sform.product && sform.qty && sform.selling && (
                <div className="total-calculation-box">
                  <span>Total Bill Amount:</span>
                  <strong>{rupees(cents(sform.selling) * Number(sform.qty))}</strong>
                </div>
              )}

              <Field
                label="Amount Paid Now (₹)"
                type="number"
                value={sform.paid}
                onChange={(v) => setSform((f) => ({ ...f, paid: v }))}
                placeholder="Enter paid amount"
              />

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Complete Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADD CUSTOMER MODAL */}
      {activeModal === "add-customer" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add Customer</h3>
                <p>Register customer in the shop khata</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addCustomer} className="modal-form">
              <Field
                label="Customer Full Name"
                value={cform.name}
                onChange={(v) => setCform((f) => ({ ...f, name: v }))}
                required
                placeholder="e.g. Rahul Sharma"
                autoFocus
              />
              <Field
                label="Mobile Phone Number"
                type="tel"
                value={cform.phone}
                onChange={(v) => setCform((f) => ({ ...f, phone: v }))}
                placeholder="e.g. 9876543210"
              />
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. COLLECT PAYMENT MODAL */}
      {activeModal === "collect-payment" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Collect Udhaar / Due Payment</h3>
                <p>Allocate received amount to pending dues</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={collectPayment} className="modal-form">
              <label className="field">
                <span className="field-label">
                  Customer <em className="required-mark">*</em>
                </span>
                <select
                  required
                  className="field-input"
                  value={collect.customer}
                  onChange={(e) => {
                    const due = balance(e.target.value);
                    setCollect((f) => ({
                      ...f,
                      customer: e.target.value,
                      amount: due > 0 ? String(due / 100) : "",
                    }));
                  }}
                >
                  <option value="">-- Choose customer --</option>
                  {data.customers
                    .filter((c) => balance(c.id) > 0)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} • Due: {rupees(balance(c.id))}
                      </option>
                    ))}
                </select>
              </label>

              {collect.customer && (
                <div className="total-calculation-box">
                  <span>Current Outstanding:</span>
                  <strong className="due-highlight">{rupees(balance(collect.customer))}</strong>
                </div>
              )}

              <Field
                label="Amount Received (₹)"
                type="number"
                value={collect.amount}
                onChange={(v) => setCollect((f) => ({ ...f, amount: v }))}
                required
                placeholder="e.g. 500"
              />

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. RESTOCK MODAL */}
      {activeModal === "restock" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Stock Up / Purchase Restock</h3>
                <p>Record goods received and update inventory counts</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addRestock} className="modal-form">
              <label className="field">
                <span className="field-label">
                  Product <em className="required-mark">*</em>
                </span>
                <select
                  required
                  className="field-input"
                  value={restock.product}
                  onChange={(e) => {
                    const prod = data.products.find((p) => p.id === e.target.value);
                    setRestock((f) => ({
                      ...f,
                      product: e.target.value,
                      cost: prod ? String(prod.cost / 100) : f.cost,
                    }));
                  }}
                >
                  <option value="">-- Select Product --</option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} • current stock {p.stock}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Supplier / Vendor</span>
                <select
                  className="field-input"
                  value={restock.vendor}
                  onChange={(e) => setRestock((f) => ({ ...f, vendor: e.target.value }))}
                >
                  <option value="">Unspecified Vendor</option>
                  {data.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid-2">
                <Field
                  label="Quantity Purchased"
                  type="number"
                  value={restock.qty}
                  onChange={(v) => setRestock((f) => ({ ...f, qty: v }))}
                  required
                />
                <Field
                  label="Unit Cost Price (₹)"
                  type="number"
                  value={restock.cost}
                  onChange={(v) => setRestock((f) => ({ ...f, cost: v }))}
                  required
                />
              </div>

              {restock.qty && restock.cost && (
                <div className="total-calculation-box">
                  <span>Total Purchase Cost:</span>
                  <strong>{rupees(cents(restock.cost) * Number(restock.qty))}</strong>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. ADD EXPENSE MODAL */}
      {activeModal === "add-expense" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Record Shop Expense</h3>
                <p>Log overheads for net profit calculations</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addExpense} className="modal-form">
              <Field
                label="Expense Description"
                value={eform.title}
                onChange={(v) => setEform((f) => ({ ...f, title: v }))}
                required
                placeholder="e.g. Shop electricity bill"
                autoFocus
              />
              <div className="form-grid-2">
                <label className="field">
                  <span className="field-label">Category</span>
                  <select
                    className="field-input"
                    value={eform.category}
                    onChange={(e) => setEform((f) => ({ ...f, category: e.target.value }))}
                  >
                    <option>Utilities</option>
                    <option>Rent</option>
                    <option>Transport</option>
                    <option>Salary</option>
                    <option>Maintenance</option>
                    <option>Packaging</option>
                    <option>Other</option>
                  </select>
                </label>
                <Field
                  label="Amount (₹)"
                  type="number"
                  value={eform.amount}
                  onChange={(v) => setEform((f) => ({ ...f, amount: v }))}
                  required
                  placeholder="e.g. 1500"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. ADD VENDOR MODAL */}
      {activeModal === "add-vendor" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add Supplier / Vendor</h3>
                <p>Register a wholesale distributor</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addVendor} className="modal-form">
              <Field
                label="Vendor / Firm Name"
                value={vform.name}
                onChange={(v) => setVform((f) => ({ ...f, name: v }))}
                required
                placeholder="e.g. Sharma General Traders"
                autoFocus
              />
              <div className="form-grid-2">
                <Field
                  label="Contact Phone"
                  type="tel"
                  value={vform.phone}
                  onChange={(v) => setVform((f) => ({ ...f, phone: v }))}
                  placeholder="e.g. 9823456781"
                />
                <Field
                  label="Category / Goods Supplied"
                  value={vform.category}
                  onChange={(v) => setVform((f) => ({ ...f, category: v }))}
                  placeholder="e.g. Grocery, Packaging"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. ADD SEASON MODAL */}
      {activeModal === "add-season" && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Create Seasonal Plan</h3>
                <p>Link products to forecast festival / seasonal rush</p>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={addSeason} className="modal-form">
              <Field
                label="Season / Festival Name"
                value={seasonForm.name}
                onChange={(v) => setSeasonForm((f) => ({ ...f, name: v }))}
                required
                placeholder="e.g. Diwali Season, Summer Beverages"
                autoFocus
              />
              <div className="form-grid-2">
                <label className="field">
                  <span className="field-label">Starts Month</span>
                  <select
                    className="field-input"
                    value={seasonForm.startMonth}
                    onChange={(e) => setSeasonForm((f) => ({ ...f, startMonth: e.target.value }))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option value={i + 1} key={i}>
                        {new Date(2020, i, 1).toLocaleDateString("en-IN", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Ends Month</span>
                  <select
                    className="field-input"
                    value={seasonForm.endMonth}
                    onChange={(e) => setSeasonForm((f) => ({ ...f, endMonth: e.target.value }))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option value={i + 1} key={i}>
                        {new Date(2020, i, 1).toLocaleDateString("en-IN", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="field-label">Link Related Products</span>
                <select
                  multiple
                  className="field-input multiple-select"
                  value={seasonForm.productIds}
                  onChange={(e) =>
                    setSeasonForm((f) => ({
                      ...f,
                      productIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                    }))
                  }
                >
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Planning Notes"
                value={seasonForm.notes}
                onChange={(v) => setSeasonForm((f) => ({ ...f, notes: v }))}
                placeholder="e.g. Order 50 sparklers 2 weeks ahead"
              />

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
