(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { token: localStorage.getItem('moneta_token') || '', email: localStorage.getItem('moneta_email') || '', name: localStorage.getItem('moneta_name') || '', authMode:'login', page:'overview', expenses:[], allExpenses:[], summary:null, budgets:[], budgetSummaries:{}, pageNum:1, limit:10, filteredCount:0, expenseCache:[], expenseCacheReady:false, editingExpense:null, editingBudget:null, confirmResolve:null, monthly:null };
  const money = v => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
  const dateToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const monthName = n => new Date(2000, Number(n)-1, 1).toLocaleString('en-IN',{month:'long'});
  const fmtDate = v => { if(!v) return '—'; const d=new Date(`${v}T00:00:00`); return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categoryClass = c => String(c||'other').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const iconFor = c => ({food:'✳',travel:'↗',shopping:'◇',bills:'▤',health:'+',education:'▣',entertainment:'♫',other:'•'}[categoryClass(c)] || '✳');
  function toast(message,type='success'){ const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;$('#toastStack').append(el);setTimeout(()=>el.remove(),4200); }
  async function api(path, options={}){
    const headers={'Content-Type':'application/json',...(options.headers||{})}; if(state.token) headers.Authorization=`Bearer ${state.token}`;
    let res; try{res=await fetch(path,{...options,headers});}catch(e){throw new Error('Could not reach the API. Check your internet connection and Render service status.');}
    let data=null; const text=await res.text(); if(text){try{data=JSON.parse(text)}catch{data=text}}
    if(!res.ok){if(res.status===401 && state.token){logout(false);throw new Error('Your session expired. Please sign in again.');} const detail=data?.detail; throw new Error(Array.isArray(detail)?detail.map(x=>x.msg).join(', '):typeof detail==='string'?detail:`Request failed (${res.status})`);}
    return data;
  }
  function setAuthMode(mode){state.authMode=mode;const register=mode==='register';$$('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));$('#nameField').hidden=!register;$('#authName').required=register;$('#authTitle').textContent=register?'Create your space.':'Welcome back.';$('#authSubtitle').textContent=register?'A few details and you are ready to go.':'Sign in to pick up where you left off.';$('#authSubmit').innerHTML=register?'Create account <span>↗</span>':'Sign in <span>↗</span>';$('#authPassword').autocomplete=register?'new-password':'current-password';$('#authError').hidden=true;}
  function showApp(){ $('#authScreen').hidden=true;$('#appShell').hidden=false;$('#profileName').textContent=state.name||state.email.split('@')[0]||'Your account';$('#profileEmail').textContent=state.email||'Signed in';$('#profileAvatar').textContent=(state.name||state.email||'M').trim().charAt(0).toUpperCase();$('#todayLabel').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();$('#headingDate').textContent=new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});$('#greetingTitle').textContent=`Good ${new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, ${(state.name||state.email.split('@')[0]||'there').split(' ')[0]}.`;initPickers();refreshAll(); }
  function logout(show=true){state.token='';localStorage.removeItem('moneta_token');localStorage.removeItem('moneta_email');localStorage.removeItem('moneta_name');state.email='';state.name='';$('#appShell').hidden=true;$('#authScreen').hidden=false;setAuthMode('login');if(show)toast('You have signed out.');}
  $('#authForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('#authSubmit');btn.disabled=true;$('#authError').hidden=true;try{if(state.authMode==='register'){const name=$('#authName').value.trim(),email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;const user=await api('/auth/register',{method:'POST',body:JSON.stringify({name,email,password}),headers:{}});state.name=user.name||name;state.email=user.email||email;const login=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});state.token=login.access_token;}else{const email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;const login=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});state.token=login.access_token;state.email=email;state.name=localStorage.getItem('moneta_name')||'';}localStorage.setItem('moneta_token',state.token);localStorage.setItem('moneta_email',state.email);localStorage.setItem('moneta_name',state.name);showApp();toast(state.authMode==='register'?'Account created. Welcome to Moneta.':'Welcome back.');}catch(err){$('#authError').textContent=err.message;$('#authError').hidden=false;}finally{btn.disabled=false;}});
  $$('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.authMode)));
  $('#logoutBtn').addEventListener('click',()=>logout());
  function closeMobileNav(){const sidebar=$('#sidebar'),scrim=$('#sidebarScrim'),toggle=$('#menuToggle');sidebar.classList.remove('open');scrim?.classList.remove('active');scrim?.setAttribute('aria-hidden','true');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation');document.body.classList.remove('nav-open');}
  function setMobileNav(open){const sidebar=$('#sidebar'),scrim=$('#sidebarScrim'),toggle=$('#menuToggle');sidebar.classList.toggle('open',Boolean(open));scrim?.classList.toggle('active',Boolean(open));scrim?.setAttribute('aria-hidden',String(!open));toggle?.setAttribute('aria-expanded',String(Boolean(open)));toggle?.setAttribute('aria-label',open?'Close navigation':'Open navigation');document.body.classList.toggle('nav-open',Boolean(open));}
  function goPage(page){if(!['overview','transactions','analytics','budgets'].includes(page))page='overview';state.page=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const title={overview:'Overview',transactions:'Transactions',analytics:'Spending insights',budgets:'Budgets'}[page];$('#topPageName').textContent=title;closeMobileNav();window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});if(page==='transactions')loadExpenses();if(page==='analytics')loadAnalytics();if(page==='budgets')loadBudgets();}
  $$('.nav-link').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.go)));$('#menuToggle').addEventListener('click',()=>setMobileNav(!$('#sidebar').classList.contains('open')));$('#sidebarScrim').addEventListener('click',closeMobileNav);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileNav();});window.addEventListener('resize',()=>{if(window.innerWidth>760)closeMobileNav();});
  function initPickers(){const now=new Date(),year=now.getFullYear();const sel=$('#analyticsYear');if(!sel.options.length){for(let y=2100;y>=2000;y--){const o=document.createElement('option');o.value=y;o.textContent=y;if(y===year)o.selected=true;sel.append(o);}}$('#budgetMonthPicker').value=`${year}-${String(now.getMonth()+1).padStart(2,'0')}`;$('#budgetMonth').value=now.getMonth()+1;$('#budgetYear').value=year;$('#comparisonMonth').value=String(now.getMonth()+1);}
  async function refreshAll(){await Promise.allSettled([loadSummary(),loadExpenses(true),loadBudgets(true)]);renderOverview();}
  async function loadSummary(){try{state.summary=await api('/expenses/summary');renderSummary();}catch(e){toast(e.message,'error');}}
  function renderSummary(){const s=state.summary||{total_spent:0,expense_count:0,category_summary:[]};$('#totalSpent').textContent=money(s.total_spent);$('#expenseCount').textContent=Number(s.expense_count||0).toLocaleString('en-IN');$('#categoryCount').textContent=(s.category_summary||[]).length;$('#categoryTotal').textContent=money(s.total_spent);renderCategoryChart($('#categoryChart'),s.category_summary||[],Number(s.total_spent||0));renderCategoryChart($('#analyticsCategories'),s.category_summary||[],Number(s.total_spent||0));}
  function categoryChartPeriod(target){const now=new Date();if(target?.id==='analyticsCategories'){const month=Number($('#comparisonMonth')?.value||now.getMonth()+1),year=Number($('#analyticsYear')?.value||now.getFullYear());return {month,year,label:`${monthName(month)} ${year}`,shareLabel:`${year} spend`};}const month=now.getMonth()+1,year=now.getFullYear();return {month,year,label:`${monthName(month)} ${year}`,shareLabel:'all-time spend'};}
  function categoryRowsForYear(rows,total,target){if(!state.expenseCacheReady)return {rows,total};const useYear=target?.id==='analyticsCategories',year=Number($('#analyticsYear')?.value||new Date().getFullYear()),groups=new Map();for(const expense of state.expenseCache){if(useYear&&Number(String(expense.expense_date||'').slice(0,4))!==year)continue;const category=String(expense.category||'Other').trim()||'Other',key=category.toLocaleLowerCase();if(!groups.has(key))groups.set(key,{category,total_spent:0,expense_count:0});const item=groups.get(key);item.total_spent+=Number(expense.amount||0);item.expense_count+=1;}const resultRows=[...groups.values()].map(r=>({...r,total_spent:Number(r.total_spent.toFixed(2))}));return {rows:resultRows,total:Number(resultRows.reduce((sum,r)=>sum+r.total_spent,0).toFixed(2))};}
  function statusForBudget(summary,limit){const amount=Number(summary?.budget_amount??limit??0),spent=Number(summary?.total_spent??0),remaining=Number(summary?.remaining_amount??(amount-spent)),pct=Number(summary?.used_percentage??(amount>0?spent/amount*100:0));if(spent>amount+0.005||remaining< -0.005||pct>100.005)return {label:'Over budget',cls:'over',key:'over'};if(spent>=amount-0.005||remaining<=0.005||pct>=99.995)return {label:'Budget reached',cls:'reached',key:'reached'};if(pct>=80)return {label:'Near limit',cls:'near',key:'near'};return {label:'On track',cls:'',key:'track'};}
  function renderCategoryChart(target,rows,total){if(!target)return;const period=categoryChartPeriod(target);({rows,total}=categoryRowsForYear(rows,total,target));if(!rows.length){target.innerHTML=`<div class="empty-state">No expenses recorded for ${esc(target.id==='analyticsCategories'?period.shareLabel:'your history')} yet. Add an expense to see your spending mix.</div>`;return;}const sorted=[...rows].sort((a,b)=>Number(b.total_spent)-Number(a.total_spent));target.innerHTML=sorted.map(r=>{const pct=total?Math.min(100,Number(r.total_spent)/total*100):0;const budget=(state.budgets||[]).find(b=>Number(b.month)===period.month&&Number(b.year)===period.year&&String(b.category||'').trim().toLocaleLowerCase()===String(r.category||'').trim().toLocaleLowerCase());let budgetMeta='';if(budget){const bs=getBudgetSummary(budget),st=statusForBudget(bs,budget.amount),used=Number(bs.used_percentage||0);budgetMeta=`<div class="category-budget-meta"><span>${esc(period.label)} budget usage</span><span class="budget-usage-pill ${st.cls}">${used.toFixed(0)}% used · ${st.label}</span></div>`;}else{budgetMeta=`<div class="category-budget-meta"><span>${esc(period.label)} budget usage</span><span class="budget-usage-pill unset">No budget set</span></div>`;}return `<div class="category-row"><div class="category-row-top"><span class="category-name"><i class="category-dot"></i>${esc(r.category)}</span><span class="category-value">${money(r.total_spent)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="category-meta"><span>${r.expense_count} transaction${r.expense_count===1?'':'s'}</span><span>${pct.toFixed(1)}% of ${esc(period.shareLabel)}</span></div>${budgetMeta}</div>`}).join('');}
  async function fetchAllExpenses(){
    // The backend currently matches category text case-sensitively. Fetch this user's
    // paginated records without filters so UI filtering can be case-insensitive and inclusive.
    const all=[];let apiPage=1;
    while(apiPage<=1000){
      const batch=await api(`/expenses/?page=${apiPage}&limit=100`);
      if(!Array.isArray(batch))throw new Error('The expenses API returned an unexpected response.');
      all.push(...batch);
      if(batch.length<100) return all;
      apiPage+=1;
    }
    throw new Error('Too many transactions to filter at once. Please narrow the range or contact support.');
  }
  function filterExpenses(expenses){
    const category=$('#filterCategory').value.trim().toLocaleLowerCase();
    const start=$('#filterStart').value;
    const end=$('#filterEnd').value;
    return expenses.filter(expense=>{
      const actualCategory=String(expense.category||'').trim().toLocaleLowerCase();
      const expenseDate=String(expense.expense_date||'').slice(0,10);
      const categoryMatches=!category||actualCategory.includes(category);
      const startMatches=!start||(expenseDate&&expenseDate>=start);
      const endMatches=!end||(expenseDate&&expenseDate<=end);
      return categoryMatches&&startMatches&&endMatches;
    });
  }
  async function loadExpenses(silent=false){
    const rows=$('#expenseRows');
    if(!silent&&rows)rows.innerHTML='<tr><td colspan="5"><div class="loading-state">Loading transactions…</div></td></tr>';
    try{
      const start=$('#filterStart').value,end=$('#filterEnd').value;
      if(start&&end&&start>end)throw new Error('Start date cannot be later than end date.');
      const all=await fetchAllExpenses();
      state.expenseCache=all;state.expenseCacheReady=true;
      const filtered=filterExpenses(all);
      state.filteredCount=filtered.length;
      const first=(state.pageNum-1)*state.limit;
      if(first>=state.filteredCount&&state.pageNum>1){state.pageNum=Math.max(1,Math.ceil(state.filteredCount/state.limit));}
      const offset=(state.pageNum-1)*state.limit;
      state.expenses=filtered.slice(offset,offset+state.limit);
      renderExpenseTable();
      if(state.budgets.length){renderBudgets();renderBudgetPreview();renderBudgetAlerts();}
      if(state.page==='overview'){state.allExpenses=all.slice(0,10);renderOverview();}
    }catch(e){if(rows)rows.innerHTML=`<tr><td colspan="5"><div class="empty-state">${esc(e.message)}</div></td></tr>`;if(!silent)toast(e.message,'error');}
  }
  function renderExpenseTable(){
    const rows=$('#expenseRows'),data=state.expenses||[],total=state.filteredCount||0;
    if(!data.length){rows.innerHTML='<tr><td colspan="5"><div class="empty-state">No expenses found for these filters. Try another category or date range.</div></td></tr>';}
    else rows.innerHTML=data.map(x=>`<tr><td><div class="transaction-cell"><div class="category-icon ${categoryClass(x.category)}">${iconFor(x.category)}</div><div><strong>${esc(x.title)}</strong><small>${esc(x.description||'Expense')} · #${x.id}</small></div></div></td><td><span class="category-pill">${esc(x.category)}</span></td><td>${fmtDate(x.expense_date)}</td><td class="table-amount">${money(x.amount)}</td><td><div class="row-actions"><button class="row-action" data-edit-expense="${x.id}" title="Edit expense" aria-label="Edit expense">✎</button><button class="row-action" data-delete-expense="${x.id}" title="Delete expense" aria-label="Delete expense">⌫</button></div></td></tr>`).join('');
    const first=total?((state.pageNum-1)*state.limit)+1:0,last=Math.min(state.pageNum*state.limit,total);
    $('#pageLabel').textContent=`Page ${state.pageNum}`;
    $('#resultsLabel').textContent=total?`Showing ${first}–${last} of ${total} expense${total===1?'':'s'} · ${state.limit} per page`:'Showing 0 expenses';
    $('#prevPage').disabled=state.pageNum<=1;
    $('#nextPage').disabled=state.pageNum*state.limit>=total;
  }
  function renderOverview(){renderSummary();renderBudgetAlerts();const list=state.allExpenses||state.expenses||[];const recent=$('#recentTransactions');if(!list.length){recent.innerHTML='<div class="empty-state">No transactions yet. Add your first expense to get started.</div>';}else recent.innerHTML=list.slice(0,5).map(x=>`<div class="recent-item"><div class="category-icon ${categoryClass(x.category)}">${iconFor(x.category)}</div><div class="recent-copy"><strong>${esc(x.title)}</strong><span>${esc(x.category)} · ${fmtDate(x.expense_date)}</span></div><div class="recent-amount">${money(x.amount)}</div></div>`).join('');$('#recentFoot').textContent=`${list.length} recent transaction${list.length===1?'':'s'}`;renderBudgetPreview();}
  $('#topAddExpense').addEventListener('click',()=>openExpense());$('#transactionsAdd').addEventListener('click',()=>openExpense());$('#applyFilters').addEventListener('click',()=>{state.pageNum=1;loadExpenses();});$('#clearFilters').addEventListener('click',()=>{$('#filterCategory').value='';$('#filterStart').value='';$('#filterEnd').value='';state.pageNum=1;loadExpenses();});$('#prevPage').addEventListener('click',()=>{if(state.pageNum>1){state.pageNum--;loadExpenses();}});$('#nextPage').addEventListener('click',()=>{if(state.pageNum*state.limit<state.filteredCount){state.pageNum++;loadExpenses();}});$('#pageLimit').addEventListener('change',()=>{state.limit=Number($('#pageLimit').value);state.pageNum=1;loadExpenses();});
  function openModal(id){$( `#${id}`).hidden=false;document.body.style.overflow='hidden';}function closeModal(id){$(`#${id}`).hidden=true;document.body.style.overflow='';}
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.modal-backdrop').forEach(m=>{if(!m.hidden)closeModal(m.id)});});
  function openExpense(item=null){state.editingExpense=item?item.id:null;$('#expenseForm').reset();$('#expenseError').hidden=true;$('#expenseModalTitle').textContent=item?'Edit expense':'Add an expense';$('#saveExpenseBtn').textContent=item?'Save changes ↗':'Save expense ↗';$('#expenseTitle').value=item?.title||'';$('#expenseAmount').value=item?.amount||'';$('#expenseCategory').value=item?.category||'';$('#expenseDate').value=item?.expense_date||dateToday();$('#expenseDescription').value=item?.description||'';openModal('expenseModal');$('#expenseTitle').focus();}
  $('#expenseForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('#saveExpenseBtn');btn.disabled=true;$('#expenseError').hidden=true;const body={title:$('#expenseTitle').value.trim(),amount:Number($('#expenseAmount').value).toFixed(2),category:$('#expenseCategory').value.trim(),expense_date:$('#expenseDate').value,description:$('#expenseDescription').value.trim()||null};try{if(state.editingExpense){await api(`/expenses/${state.editingExpense}`,{method:'PATCH',body:JSON.stringify(body)});toast('Expense updated successfully.');}else{await api('/expenses/',{method:'POST',body:JSON.stringify(body)});toast('Expense added successfully.');}closeModal('expenseModal');await Promise.allSettled([loadSummary(),loadExpenses(true),loadBudgets(true)]);state.allExpenses=await api('/expenses/?page=1&limit=10').catch(()=>[]);renderOverview();}catch(err){$('#expenseError').textContent=err.message;$('#expenseError').hidden=false;}finally{btn.disabled=false;}});
  async function askConfirm(title,message,action='Delete'){ $('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;$('#confirmOkay').textContent=action;openModal('confirmModal');return new Promise(resolve=>{state.confirmResolve=resolve;}); }
  function finishConfirm(value){closeModal('confirmModal');if(state.confirmResolve){state.confirmResolve(value);state.confirmResolve=null;}}$('#confirmCancel').addEventListener('click',()=>finishConfirm(false));$('#confirmOkay').addEventListener('click',()=>finishConfirm(true));
  document.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-expense]');const del=e.target.closest('[data-delete-expense]');if(edit){const id=Number(edit.dataset.editExpense);try{const item=await api(`/expenses/${id}`);openExpense(item);}catch(err){toast(err.message,'error');}}if(del){const id=Number(del.dataset.deleteExpense);const ok=await askConfirm('Delete this expense?','This transaction will be permanently removed from your expense history.');if(!ok)return;try{await api(`/expenses/${id}`,{method:'DELETE'});toast('Expense deleted.');if(state.expenses.length===1&&state.pageNum>1)state.pageNum--;await Promise.allSettled([loadSummary(),loadExpenses(true)]);state.allExpenses=await api('/expenses/?page=1&limit=10').catch(()=>[]);renderOverview();}catch(err){toast(err.message,'error');}}});
  async function analyticsFromExpenseRecords(year){
    // Compatibility fallback for deployments where the monthly analytics route
    // has not been redeployed yet. Use the existing, authenticated expense API.
    const collected=[];
    for(let page=1;page<=1000;page++){
      const rows=await api(`/expenses/?start_date=${year}-01-01&end_date=${year}-12-31&page=${page}&limit=100`);
      if(!Array.isArray(rows))throw new Error('The expenses API returned an unexpected response.');
      collected.push(...rows);
      if(rows.length<100)break;
    }
    const byMonth=Array.from({length:12},(_,i)=>({month:i+1,total_spent:0,expense_count:0}));
    for(const expense of collected){
      const month=Number(String(expense.expense_date||'').slice(5,7));
      if(month>=1&&month<=12){byMonth[month-1].total_spent+=Number(expense.amount||0);byMonth[month-1].expense_count+=1;}
    }
    byMonth.forEach(row=>{row.total_spent=Number(row.total_spent.toFixed(2));});
    return {year,total_spent:Number(byMonth.reduce((sum,row)=>sum+row.total_spent,0).toFixed(2)),monthly_summary:byMonth};
  }
  async function fetchMonthlyAnalytics(year){
    try{return await api(`/expenses/analytics/monthly?year=${year}`);}
    catch(routeError){return analyticsFromExpenseRecords(year);}
  }
  async function loadAnalytics(){
    const year=Number($('#analyticsYear').value||new Date().getFullYear());
    $('#monthlyChart').innerHTML='<div class="loading-state">Loading monthly insights…</div>';
    $('#comparisonBars').innerHTML='<div class="loading-state">Comparing monthly spending…</div>';
    try{
      const monthly=await fetchMonthlyAnalytics(year);
      const summary=await api('/expenses/summary');
      state.monthly=monthly;
      const rows=monthly.monthly_summary||[];
      $('#analyticsTotal').textContent=money(monthly.total_spent);
      const high=[...rows].sort((a,b)=>Number(b.total_spent)-Number(a.total_spent))[0];
      $('#highestMonth').textContent=high&&Number(high.total_spent)>0?monthName(high.month).slice(0,3):'—';
      $('#highestMonthValue').textContent=high&&Number(high.total_spent)>0?money(high.total_spent):'No spending recorded';
      $('#monthlyAverage').textContent=money(Number(monthly.total_spent||0)/12);
      const max=Math.max(...rows.map(r=>Number(r.total_spent||0)),1);
      $('#monthlyChart').innerHTML=rows.map(r=>{
        const value=Number(r.total_spent||0),h=Math.max(value?3:0,value/max*100);
        return `<div class="month-column" title="${esc(monthName(r.month))}: ${money(value)} · ${r.expense_count} expenses"><div class="month-bar-area"><div class="month-bar ${r.month===new Date().getMonth()+1&&year===new Date().getFullYear()?'current':''}" style="height:${h}%"></div></div><span>${monthName(r.month).slice(0,1)}</span><strong>${value?compactMoney(value):'—'}</strong></div>`;
      }).join('');
      renderCategoryChart($('#analyticsCategories'),summary.category_summary||[],Number(summary.total_spent||0));
      await renderMonthlyComparison(year,monthly);
    }catch(err){
      $('#monthlyChart').innerHTML=`<div class="empty-state">${esc(err.message)}. Check the expenses endpoint and sign-in session.</div>`;
      $('#comparisonBars').innerHTML=`<div class="empty-state">${esc(err.message)}</div>`;
      toast(err.message,'error');
    }
  }
  async function renderMonthlyComparison(year,monthly){
    const month=Number($('#comparisonMonth').value||new Date().getMonth()+1);
    const rows=monthly.monthly_summary||[];
    const current=rows.find(r=>Number(r.month)===month)||{month,total_spent:0,expense_count:0};
    let previousMonth=month===1?12:month-1;
    let previousYear=month===1?year-1:year;
    let previous={month:previousMonth,total_spent:0,expense_count:0};
    let priorUnavailable=false;
    if(month===1){
      if(previousYear>=2000){
        try{const previousAnnual=await fetchMonthlyAnalytics(previousYear);previous=(previousAnnual.monthly_summary||[]).find(r=>Number(r.month)===12)||previous;}
        catch(e){priorUnavailable=true;}
      }else{priorUnavailable=true;}
    }else{
      previous=rows.find(r=>Number(r.month)===previousMonth)||previous;
    }
    const currentValue=Number(current.total_spent||0),previousValue=Number(previous.total_spent||0),delta=Number((currentValue-previousValue).toFixed(2));
    const pct=previousValue>0?(delta/previousValue)*100:null;
    const currentLabel=`${monthName(month)} ${year}`,previousLabel=`${monthName(previousMonth)} ${previousYear}`;
    $('#comparisonCurrentLabel').textContent=currentLabel;
    $('#comparisonPreviousLabel').textContent=previousLabel;
    $('#comparisonCurrentValue').textContent=money(currentValue);
    $('#comparisonPreviousValue').textContent=priorUnavailable?'—':money(previousValue);
    const change=$('#comparisonChangeAmount');
    change.classList.remove('increase','decrease','neutral');
    if(priorUnavailable){change.textContent='—';change.classList.add('neutral');$('#comparisonChangeText').textContent='Previous-year history is unavailable before 2000.';}
    else if(Math.abs(delta)<0.005){change.textContent=money(0);change.classList.add('neutral');$('#comparisonChangeText').textContent='No change compared with the previous month.';}
    else if(previousValue===0&&currentValue>0){change.textContent=`+${money(delta)}`;change.classList.add('increase');$('#comparisonChangeText').textContent='New spending this month; previous month was ₹0.';}
    else if(delta>0){change.textContent=`+${money(delta)}`;change.classList.add('increase');$('#comparisonChangeText').textContent=`Spending increased ${pct.toFixed(1)}% compared with the previous month.`;}
    else{change.textContent=`−${money(Math.abs(delta))}`;change.classList.add('decrease');$('#comparisonChangeText').textContent=`Spending decreased ${Math.abs(pct).toFixed(1)}% compared with the previous month.`;}
    const max=Math.max(currentValue,previousValue,1),curWidth=currentValue?Math.max(2,currentValue/max*100):0,prevWidth=previousValue?Math.max(2,previousValue/max*100):0;
    $('#comparisonBars').innerHTML=`<div class="comparison-bar-row"><div class="comparison-bar-heading"><span>${esc(currentLabel)}</span><strong>${money(currentValue)}</strong></div><div class="comparison-track"><div class="comparison-fill current-fill" style="width:${curWidth}%"></div></div></div><div class="comparison-bar-row"><div class="comparison-bar-heading"><span>${esc(previousLabel)}</span><strong>${priorUnavailable?'Unavailable':money(previousValue)}</strong></div><div class="comparison-track"><div class="comparison-fill previous-fill" style="width:${prevWidth}%"></div></div></div>`;
  }
  function compactMoney(v){return v>=100000?`₹${(v/100000).toFixed(1)}L`:v>=1000?`₹${(v/1000).toFixed(1)}k`:`₹${Math.round(v)}`;}$('#analyticsYear').addEventListener('change',loadAnalytics);$('#comparisonMonth').addEventListener('change',loadAnalytics);
  async function loadBudgets(silent=false){try{state.budgets=await api('/budgets/');state.budgetSummaries={};await Promise.all(state.budgets.map(async b=>{try{state.budgetSummaries[b.id]=await api(`/budgets/${b.id}/summary`);}catch(e){state.budgetSummaries[b.id]=null;}}));$('#budgetCount').textContent=state.budgets.length;renderBudgets();renderBudgetPreview();renderBudgetAlerts();}catch(err){if(!silent)toast(err.message,'error');$('#budgetsGrid').innerHTML=`<div class="empty-state">${esc(err.message)}</div>`;}}
  function selectedBudgetMonth(){const v=$('#budgetMonthPicker').value||`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;const [year,month]=v.split('-').map(Number);return {year,month};}
  function getBudgetSummary(b){
    if(state.expenseCacheReady){
      const wanted=String(b.category||'').trim().toLocaleLowerCase();
      const total=state.expenseCache.filter(e=>String(e.category||'').trim().toLocaleLowerCase()===wanted&&Number(String(e.expense_date||'').slice(5,7))===Number(b.month)&&Number(String(e.expense_date||'').slice(0,4))===Number(b.year)).reduce((sum,e)=>sum+Number(e.amount||0),0);
      const amount=Number(b.amount||0),spent=Number(total.toFixed(2));
      return {budget_amount:amount,total_spent:spent,remaining_amount:Number((amount-spent).toFixed(2)),used_percentage:amount>0?Number((spent/amount*100).toFixed(2)):0,category:b.category,month:b.month,year:b.year};
    }
    return state.budgetSummaries[b.id]||{budget_amount:b.amount,total_spent:0,remaining_amount:b.amount,used_percentage:0,category:b.category,month:b.month,year:b.year};
  }
  function renderBudgetAlertList(target,year,month){
    if(!target)return;
    const list=(state.budgets||[]).filter(b=>Number(b.month)===Number(month)&&Number(b.year)===Number(year));
    if(!list.length){target.innerHTML=`<div class="budget-alert-empty"><span class="budget-alert-icon calm">✓</span><div><strong>No budgets to monitor</strong><p>Create a monthly budget for ${esc(monthName(month))} ${year} to receive spending alerts.</p></div></div>`;return;}
    const alerts=list.map(b=>{const summary=getBudgetSummary(b),status=statusForBudget(summary,b.amount);return {budget:b,summary,pct:Number(summary.used_percentage||0),status};}).filter(x=>x.pct>=80||x.status.key==='reached'||x.status.key==='over').sort((a,b)=>b.pct-a.pct);
    if(!alerts.length){target.innerHTML=`<div class="budget-alert-empty"><span class="budget-alert-icon calm">✓</span><div><strong>All clear for ${esc(monthName(month))} ${year}</strong><p>Every budget is below the 80% warning threshold.</p></div></div>`;return;}
    target.innerHTML=alerts.map(({budget,summary,pct,status})=>{
      const over=status.key==='over',atLimit=status.key==='reached',label=over?'Budget exceeded':atLimit?'Budget limit reached':'Approaching limit',remaining=Number(summary.remaining_amount??(Number(budget.amount)-Number(summary.total_spent||0)));
      const detail=over?`${money(Math.abs(remaining))} over the limit`:atLimit?'You have used the full budget':`${money(Math.max(0,remaining))} remaining`;
      const alertClass=over?'alert-over':atLimit?'alert-reached':'alert-near';
      return `<article class="budget-alert-row ${alertClass}"><span class="budget-alert-icon">${over?'!':atLimit?'✓':'↗'}</span><div class="budget-alert-copy"><div class="budget-alert-title"><strong>${esc(budget.category)} · ${label}</strong><span>${pct.toFixed(0)}%</span></div><p>${money(summary.total_spent)} spent of ${money(budget.amount)} · ${detail}.</p><div class="budget-alert-track"><div class="budget-alert-fill" style="width:${Math.min(100,Math.max(0,pct))}%"></div></div></div></article>`;
    }).join('');
  }
  function renderBudgetAlerts(){const now=new Date();renderBudgetAlertList($('#overviewBudgetAlerts'),now.getFullYear(),now.getMonth()+1);const selected=selectedBudgetMonth();renderBudgetAlertList($('#budgetAlerts'),selected.year,selected.month);}
  function renderBudgetPreview(){const now=new Date(),month=now.getMonth()+1,year=now.getFullYear();const list=(state.budgets||[]).filter(b=>Number(b.month)===month&&Number(b.year)===year).slice(0,3);if(!list.length){$('#budgetPreview').innerHTML='<div class="empty-state">No budgets for this month yet. Set a limit to keep your spending on track.</div>';return;}$('#budgetPreview').innerHTML=list.map(b=>{const s=getBudgetSummary(b),pct=Math.max(0,Number(s.used_percentage||0)),status=statusForBudget(s,b.amount);return `<div class="budget-mini"><div class="budget-mini-head"><span>${esc(b.category)}</span><span>${pct.toFixed(0)}%</span></div><small>${money(s.total_spent)} spent of ${money(b.amount)}</small><div class="budget-mini-status"><strong>${money(s.remaining_amount)} <span>remaining</span></strong><span class="budget-status ${status.cls}">${status.label}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,pct)}%;background:${status.key==='over'?'#cf6464':status.key==='reached'?'#8c79f4':status.key==='near'?'#edb45e':'var(--green)'}"></div></div></div>`}).join('');}
  function renderBudgetHealth(list){const counts={track:0,near:0,reached:0,over:0};for(const budget of list){const status=statusForBudget(getBudgetSummary(budget),budget.amount);counts[status.key]=(counts[status.key]||0)+1;}for(const key of Object.keys(counts)){const node=$(`#budgetHealth${key[0].toUpperCase()+key.slice(1)}`);if(node)node.textContent=counts[key];}}
  function renderBudgets(){const {year,month}=selectedBudgetMonth(),list=state.budgets.filter(b=>Number(b.month)===month&&Number(b.year)===year);renderBudgetAlerts();renderBudgetHealth(list);$('#budgetMonthLabel').textContent=`${monthName(month)} ${year}`;$('#budgetSummaryCount').textContent=list.length;$('#budgetPlanned').textContent=money(list.reduce((sum,b)=>sum+Number(b.amount||0),0));const grid=$('#budgetsGrid');if(!list.length){grid.innerHTML=`<div class="panel" style="grid-column:1/-1"><div class="empty-state">No budgets for ${monthName(month)} ${year}. Create one to start planning your spending.</div></div>`;return;}grid.innerHTML=list.map(b=>{const s=getBudgetSummary(b),pct=Number(s.used_percentage||0),remaining=Number(s.remaining_amount??(Number(b.amount)-Number(s.total_spent||0))),status=statusForBudget(s,b.amount);return `<article class="budget-card"><div class="budget-card-top"><div class="budget-card-title"><div class="category-icon ${categoryClass(b.category)}">${iconFor(b.category)}</div><div><h3>${esc(b.category)}</h3><p>${monthName(b.month)} ${b.year}</p></div></div><div class="budget-actions"><button data-edit-budget="${b.id}" title="Edit budget">✎</button><button data-delete-budget="${b.id}" title="Delete budget">⌫</button></div></div><div class="budget-card-total"><div><span>MONTHLY LIMIT</span><br><strong>${money(b.amount)}</strong></div><span class="budget-status ${status.cls}">${status.label}</span></div><div class="budget-card-progress"><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,pct))}%;background:${status.key==='over'?'#cf6464':status.key==='reached'?'#8c79f4':status.key==='near'?'#edb45e':'var(--green)'}"></div></div><div class="budget-percent"><span>${money(s.total_spent)} spent</span><strong>${pct.toFixed(1)}% used</strong></div></div><div class="budget-card-stats"><div><span>${status.key==='over'?'OVER LIMIT':status.key==='reached'?'LIMIT REACHED':'REMAINING'}</span><strong style="color:${remaining< -0.005?'#c95151':status.key==='reached'?'#6553c9':'inherit'}">${remaining< -0.005?`${money(Math.abs(remaining))} over`:money(Math.max(0,remaining))}</strong></div><div><span>MONTHLY SPEND</span><strong>${money(s.total_spent)}</strong></div></div></article>`}).join('');}
  $('#budgetMonthPicker').addEventListener('change',renderBudgets);$('#addBudgetBtn').addEventListener('click',()=>openBudget());
  function openBudget(item=null){state.editingBudget=item?item.id:null;$('#budgetForm').reset();$('#budgetError').hidden=true;$('#budgetModalTitle').textContent=item?'Edit budget':'Create a budget';$('#saveBudgetBtn').textContent=item?'Save changes ↗':'Save budget ↗';const now=new Date();$('#budgetCategory').value=item?.category||'';$('#budgetAmount').value=item?.amount||'';$('#budgetMonth').value=item?.month||now.getMonth()+1;$('#budgetYear').value=item?.year||now.getFullYear();openModal('budgetModal');$('#budgetCategory').focus();}
  $('#budgetForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('#saveBudgetBtn');btn.disabled=true;$('#budgetError').hidden=true;const body={category:$('#budgetCategory').value.trim(),amount:Number($('#budgetAmount').value).toFixed(2),month:Number($('#budgetMonth').value),year:Number($('#budgetYear').value)};try{if(state.editingBudget){await api(`/budgets/${state.editingBudget}`,{method:'PATCH',body:JSON.stringify(body)});toast('Budget updated.');}else{await api('/budgets/',{method:'POST',body:JSON.stringify(body)});toast('Budget created.');}closeModal('budgetModal');$('#budgetMonthPicker').value=`${body.year}-${String(body.month).padStart(2,'0')}`;await loadBudgets(true);renderOverview();}catch(err){$('#budgetError').textContent=err.message;$('#budgetError').hidden=false;}finally{btn.disabled=false;}});
  document.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-budget]'),del=e.target.closest('[data-delete-budget]');if(edit){const b=state.budgets.find(x=>x.id===Number(edit.dataset.editBudget));if(b)openBudget(b);}if(del){const id=Number(del.dataset.deleteBudget),b=state.budgets.find(x=>x.id===id);const ok=await askConfirm('Delete this budget?',`The ${b?.category||'selected'} budget will be permanently removed.`);if(!ok)return;try{await api(`/budgets/${id}`,{method:'DELETE'});toast('Budget deleted.');await loadBudgets(true);renderOverview();}catch(err){toast(err.message,'error');}}});
  if(state.token){showApp();}else{setAuthMode('login');$('#authScreen').hidden=false;$('#appShell').hidden=true;}
})();
