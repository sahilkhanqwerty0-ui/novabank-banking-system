let state = { balance: 0, transactions: [], balanceHidden: false };

const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}
function renderBalance(){
  $("balance").textContent=state.balanceHidden ? "₹ ••••••" : money(state.balance);
  $("transferBalance").textContent=money(state.balance);
  $("saved").textContent=money(state.balance).replace(".40","");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function txHtml(t){
  return `<div class="transaction"><div class="tx-left"><div class="tx-icon">${t.type==="credit"?"↓":"↑"}</div><div><div class="tx-name">${escapeHtml(t.name)}</div><div class="tx-date">${t.date}</div></div></div><div class="tx-amount ${t.type}">${t.type==="credit"?"+":"-"}${money(t.amount)}</div></div>`;
}
function renderTransactions(list=state.transactions){
  $("recentTransactions").innerHTML=list.slice(0,5).map(txHtml).join("");
  $("allTransactions").innerHTML=list.map(txHtml).join("") || `<div class="transaction"><span class="muted">No transactions found.</span></div>`;
}
function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  $(page).classList.add("active-page");
  const nav=document.querySelector(`[data-page="${page}"]`); if(nav) nav.classList.add("active");
  const titles={dashboard:"Good morning, Sahil 👋",transfer:"Transfer money",transactions:"Transaction history",cards:"My cards",analytics:"Spending analytics",profile:"Profile & settings"};
  $("pageTitle").textContent=titles[page]||"NovaBank";
}
async function api(url, options={}){
  const res=await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message||"Something went wrong");
  return data;
}
async function loadAccount(){
  try{
    const data=await api("/api/account");
    state.balance=data.balance;
    state.transactions=data.transactions;
    renderBalance(); renderTransactions();
  }catch(e){toast(e.message)}
}
function openModal(title,text,buttonText,action){
  $("modalContent").innerHTML=`<h3>${title}</h3><p>${text}</p><button id="modalAction" class="primary-btn">${buttonText}</button>`;
  $("modal").classList.remove("hidden");
  $("modalAction").onclick=async()=>{try{await action();$("modal").classList.add("hidden")}catch(e){toast(e.message)}};
}
async function downloadStatement(){
  const data=await api("/api/transactions/export");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([data.csv],{type:"text/csv"}));
  a.download="novabank-statement.csv";a.click();URL.revokeObjectURL(a.href);toast("Statement downloaded");
}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("loginEmail").value,password:$("loginPassword").value})});
    $("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");
    await loadAccount();toast("Welcome back, Sahil!");
  }catch(e){toast(e.message)}
});
$("logoutBtn").onclick=async()=>{try{await api("/api/auth/logout",{method:"POST"})}catch(e){}$("app").classList.add("hidden");$("loginScreen").classList.remove("hidden");};
$("balanceToggle").onclick=()=>{state.balanceHidden=!state.balanceHidden;renderBalance();};
$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("novaDark",document.body.classList.contains("dark"));};
$("notifyBtn").onclick=()=>toast("You have no new notifications.");
$("closeModal").onclick=()=>$("modal").classList.add("hidden");

document.addEventListener("click",e=>{
  const page=e.target.closest("[data-page]"); if(page){showPage(page.dataset.page);return;}
  const action=e.target.closest("[data-action]"); if(!action)return;
  const a=action.dataset.action;
  if(a==="transfer")showPage("transfer");
  if(a==="statement")downloadStatement().catch(e=>toast(e.message));
  if(a==="deposit"||a==="withdraw"){
    const isDeposit=a==="deposit";
    openModal(isDeposit?"Add money":"Withdraw money",`Enter an amount to ${isDeposit?"add to":"withdraw from"} your demo account.`,isDeposit?"Add money":"Withdraw",async()=>{
      const amount=Number(prompt("Amount (₹):"));
      if(!amount||amount<=0)throw new Error("Please enter a valid amount.");
      const data=await api(isDeposit?"/api/account/deposit":"/api/account/withdraw",{method:"POST",body:JSON.stringify({amount})});
      state.balance=data.balance;state.transactions=data.transactions;renderBalance();renderTransactions();toast(isDeposit?"Money added successfully":"Withdrawal completed");
    });
  }
});

$("transferForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("recipient").value.trim(), amount=Number($("transferAmount").value);
  if(amount<=0){toast("Enter a valid amount.");return;}
  openModal("Confirm transfer",`Send ${money(amount)} to ${escapeHtml(name)}? This is a demo transaction and does not move real money.`,"Confirm transfer",async()=>{
    const data=await api("/api/transfer",{method:"POST",body:JSON.stringify({
      recipient:name,accountNumber:$("accountNumber").value.trim(),ifsc:$("ifsc").value.trim(),
      amount,note:$("transferNote").value.trim()
    })});
    state.balance=data.balance;state.transactions=data.transactions;renderBalance();renderTransactions();
    e.target.reset();showPage("transactions");toast("Transfer completed successfully");
  });
});
$("searchTransactions").addEventListener("input",filterTransactions);
$("filterType").addEventListener("change",filterTransactions);
function filterTransactions(){
  const q=$("searchTransactions").value.toLowerCase(),type=$("filterType").value;
  renderTransactions(state.transactions.filter(t=>(t.name.toLowerCase().includes(q)||t.date.toLowerCase().includes(q))&&(type==="all"||t.type===type)));
}
$("freezeBtn").onclick=async()=>{const b=$("freezeBtn");try{const data=await api("/api/card/freeze",{method:"POST"});b.textContent=data.frozen?"Unfreeze card":"Freeze card";toast(data.frozen?"Card frozen":"Card unfrozen")}catch(e){toast(e.message)}};

if(localStorage.getItem("novaDark")==="true")document.body.classList.add("dark");
(async()=>{try{const data=await api("/api/auth/session");if(data.loggedIn){$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");await loadAccount()}}catch(e){}})();