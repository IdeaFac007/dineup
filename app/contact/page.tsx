export const metadata = { title: "Contact DineUp", description: "Contact DineUp support." };

export default function ContactPage() {
  return <main style={{maxWidth:900,margin:"0 auto",padding:"56px 24px",fontFamily:"Arial,sans-serif",lineHeight:1.7}}>
    <a href="/">← DineUp</a><h1>Contact DineUp</h1><p>For account, restaurant listing, payment, refund, privacy, or general support, email our team.</p>
    <div style={{border:"1px solid #ddd",borderRadius:16,padding:24,background:"#fff"}}>
      <h2>Support</h2><p><a href="mailto:contact@dineupindia.com">contact@dineupindia.com</a></p>
      <h2>Restaurant partners</h2><p>For listing, claim, bidding, or account assistance, include your restaurant name and registered email.</p>
      <h2>Payment/refund queries</h2><p>Include your bid or transaction reference and payment amount. Do not send card numbers, CVV, OTPs, passwords, or other authentication secrets by email.</p>
    </div>
  </main>;
}
