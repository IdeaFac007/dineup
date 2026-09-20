"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
};

type CartLine = { menu_item_id: number; quantity: number };

export default function RestaurantMenuOrder({ restaurantId }: { restaurantId: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: menu }, { data: auth }] = await Promise.all([
        supabase.from("restaurant_menu_items")
          .select("id,name,description,price,image_url,category,is_available")
          .eq("restaurant_id", restaurantId)
          .eq("is_available", true)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),
        supabase.auth.getUser()
      ]);
      if (cancelled) return;
      setItems((menu || []).map((x: any) => ({
        ...x,
        id: Number(x.id),
        price: Number(x.price) || 0
      })));
      const uid = auth.user?.id || null;
      setUserId(uid);
      if (uid) {
        const { data: savedCart } = await supabase.from("customer_carts")
          .select("id")
          .eq("user_id", uid)
          .eq("restaurant_id", restaurantId)
          .maybeSingle();
        if (savedCart) {
          const { data: lines } = await supabase.from("customer_cart_items")
            .select("menu_item_id,quantity")
            .eq("cart_id", savedCart.id);
          setCart((lines || []).map((x: any) => ({
            menu_item_id: Number(x.menu_item_id),
            quantity: Number(x.quantity) || 1
          })));
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [restaurantId]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return items.map(x => (x.category || "Popular").trim() || "Popular")
      .filter(x => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [items]);

  const cartCount = cart.reduce((sum, x) => sum + x.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => {
    const item = items.find(x => x.id === line.menu_item_id);
    return sum + (item?.price || 0) * line.quantity;
  }, 0);

  async function add(item: MenuItem) {
    if (!userId) {
      router.push("/login?next=" + encodeURIComponent(window.location.pathname));
      return;
    }
    setMessage("");
    setCartLoading(true);
    try {
      let cartId: number | null = null;
      const { data: existing } = await supabase.from("customer_carts")
        .select("id")
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (existing) cartId = Number(existing.id);
      else {
        const { data: created, error } = await supabase.from("customer_carts")
          .insert({ user_id: userId, restaurant_id: restaurantId })
          .select("id")
          .single();
        if (error) throw error;
        cartId = Number(created.id);
      }

      const current = cart.find(x => x.menu_item_id === item.id);
      const nextQuantity = (current?.quantity || 0) + 1;
      const { error } = await supabase.from("customer_cart_items").upsert(
        { cart_id: cartId, menu_item_id: item.id, quantity: nextQuantity },
        { onConflict: "cart_id,menu_item_id" }
      );
      if (error) throw error;
      setCart(prev => current
        ? prev.map(x => x.menu_item_id === item.id ? { ...x, quantity: nextQuantity } : x)
        : [...prev, { menu_item_id: item.id, quantity: 1 }]);
      setMessage(item.name + " added to cart.");
    } catch (e: any) {
      setMessage(e?.message || "Unable to update your cart.");
    } finally {
      setCartLoading(false);
    }
  }

  async function remove(itemId: number) {
    if (!userId) return;
    const current = cart.find(x => x.menu_item_id === itemId);
    if (!current) return;
    setCartLoading(true);
    try {
      const { data: savedCart } = await supabase.from("customer_carts")
        .select("id").eq("user_id", userId).eq("restaurant_id", restaurantId).maybeSingle();
      if (!savedCart) return;
      if (current.quantity <= 1) {
        await supabase.from("customer_cart_items").delete()
          .eq("cart_id", savedCart.id).eq("menu_item_id", itemId);
        setCart(prev => prev.filter(x => x.menu_item_id !== itemId));
      } else {
        await supabase.from("customer_cart_items").update({ quantity: current.quantity - 1 })
          .eq("cart_id", savedCart.id).eq("menu_item_id", itemId);
        setCart(prev => prev.map(x => x.menu_item_id === itemId ? { ...x, quantity: x.quantity - 1 } : x));
      }
    } finally {
      setCartLoading(false);
    }
  }

  if (loading || !items.length) return null;

  return (
    <section className="menuOrder" aria-labelledby="dineup-menu-title">
      <div className="menuHeader">
        <div>
          <small>ORDER ON DINEUP</small>
          <h2 id="dineup-menu-title">Menu</h2>
          <p>Choose your favourites and add them to your DineUp cart.</p>
        </div>
        <div className="cartBadge" aria-label={cartCount + " items in cart"}>
          <span>Cart</span><strong>{cartCount}</strong>
        </div>
      </div>
      {categories.map(category => (
        <div className="menuCategory" key={category}>
          <h3>{category}</h3>
          <div className="menuGrid">
            {items.filter(item => ((item.category || "Popular").trim() || "Popular") === category).map(item => {
              const qty = cart.find(x => x.menu_item_id === item.id)?.quantity || 0;
              return (
                <article className="menuItem" key={item.id}>
                  <div className="menuItemBody">
                    <div>
                      <h4>{item.name}</h4>
                      {item.description && <p>{item.description}</p>}
                      <strong>₹{item.price.toLocaleString("en-IN")}</strong>
                    </div>
                    <button type="button" onClick={() => void add(item)} disabled={cartLoading}>
                      {qty ? "+" + qty : "Add"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
      {cartCount > 0 && (
        <div className="cartBar">
          <div><b>{cartCount} item{cartCount === 1 ? "" : "s"}</b><span>₹{cartTotal.toLocaleString("en-IN")}</span></div>
          <div className="cartActions">
            <button type="button" className="clearCart" onClick={() => cart.forEach(x => void remove(x.menu_item_id))} disabled={cartLoading}>Clear</button>
            <button type="button" className="checkoutPreview" onClick={() => setMessage("Checkout is coming in the next DineUp order phase.")}>View cart →</button>
          </div>
        </div>
      )}
      {message && <div className="menuMessage" role="status" aria-live="polite">{message}</div>}
      <style jsx>{`
        .menuOrder{margin-top:24px;padding:24px;border:1px solid #e7e7e7;border-radius:18px;background:#fff}
        .menuHeader{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
        .menuHeader small{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}
        .menuHeader h2{margin:6px 0 4px;font-size:26px;letter-spacing:-.6px}
        .menuHeader p{margin:0;color:#666;font-size:13px}
        .cartBadge{min-width:72px;padding:9px 12px;border-radius:12px;background:#111;color:#fff;text-align:center}
        .cartBadge span{display:block;font-size:9px;color:#bbb}.cartBadge strong{font-size:20px}
        .menuCategory{margin-top:24px}.menuCategory h3{font-size:15px;margin:0 0 10px}
        .menuGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .menuItem{border:1px solid #ececec;border-radius:14px;padding:14px;background:#fafafa}
        .menuItemBody{display:flex;justify-content:space-between;gap:12px;align-items:flex-end}
        .menuItem h4{margin:0 0 5px;font-size:14px}.menuItem p{margin:0 0 8px;color:#777;font-size:11px;line-height:1.45}
        .menuItem strong{font-size:13px}.menuItem button,.checkoutPreview,.clearCart{border:0;border-radius:9px;padding:9px 12px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}
        .menuItem button{background:#111;color:#fff;min-width:52px}.menuItem button:disabled{opacity:.5}
        .cartBar{position:sticky;bottom:16px;margin-top:18px;padding:12px 14px;border-radius:13px;background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;box-shadow:0 12px 35px rgba(0,0,0,.18)}
        .cartBar div:first-child{display:flex;gap:10px;align-items:center}.cartBar span{color:#bbb;font-size:12px}.cartActions{display:flex;gap:7px}.clearCart{background:#333;color:#fff}.checkoutPreview{background:#fff;color:#111}
        .menuMessage{margin-top:10px;padding:10px 12px;border-radius:9px;background:#f4f7f4;color:#46604d;font-size:11px;font-weight:700}
        @media(max-width:650px){.menuOrder{padding:18px}.menuGrid{grid-template-columns:1fr}.menuHeader p{max-width:240px}.cartBar{bottom:8px}}
      `}</style>
    </section>
  );
}
