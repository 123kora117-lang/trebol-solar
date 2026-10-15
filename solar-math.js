(function(root){
  const n=(v,d=0)=>Number.isFinite(Number(v))&&v!==''&&v!==null?Number(v):d;
  const r2=x=>Math.round(x*100)/100;
  function calculate(x){
    const daily=n(x.billKwh)/Math.max(1,n(x.periodDays,1));
    const annual=daily*365,future=annual*(1+n(x.growthPct)/100),kwp=future/(365*n(x.yield,1));
    const panelCount=Math.max(0,Math.ceil(kwp*1000/Math.max(1,n(x.panelW,1))-1e-9)),scenario=n(x.scenarioPanels);
    const scenarioKwp=scenario*n(x.panelW)/1000,gen=scenarioKwp*n(x.yield)*365;
    const roofArea=scenario*n(x.panelArea)*(1+n(x.clearancePct)/100);
    const slack=1+n(x.slackPct,20)/100;
    const inv=n(x.inverterKw),dcacActual=inv>0?scenarioKwp/inv:NaN;
    const warn=[];
    if(inv>0&&dcacActual<1)warn.push('Relación DC/AC menor a 1.0: inversor sobrado.');
    if(inv>0&&dcacActual>1.35)warn.push('Relación DC/AC mayor a 1.35: posible recorte de potencia; revisa el inversor.');
    return {daily,annual,future,kwp,n:panelCount,scenario,scenarioKwp,gen,margin:future?gen/future-1:0,roofArea,
      dcac:scenarioKwp/Math.max(.1,n(x.dcac,1)),cable:Math.ceil((n(x.roofHeight)+n(x.cableExtra))*2*slack),
      dailyFuture:future/365,coverage:future?gen/future:0,coverageNow:annual?gen/annual:0,dcacActual,inverterKw:inv,warn};
  }
  function scenarioStats(x,count){
    const c=calculate({...x,scenarioPanels:count});
    return {count:n(count),kWp:c.scenarioKwp,genYear:c.gen,genDay:c.gen/365,coverage:c.coverage,coverageNow:c.coverageNow,
      margin:c.gen-c.future,roofArea:c.roofArea,dcacActual:c.dcacActual,warn:c.warn,covers:n(count)>=c.n};
  }
  const RULES={panels:'Por panel',panels4:'Por panel ×4',pairs:'Pares MC4',dcCable:'Cable CC (m)',acCable:'Cable CA (m)',conduit:'Canalización (m)',one:'Fija (1)',manual:'Manual'};
  function autoQty(rule,x,count){
    const s=1+n(x.slackPct,20)/100,st=Math.max(1,Math.round(n(x.strings,2)));
    switch(rule){
      case 'panels':return count;
      case 'panels4':return count*4;
      case 'pairs':return st*2+2;
      case 'dcCable':return Math.ceil((n(x.roofHeight)+n(x.cableExtra))*2*s*st);
      case 'acCable':return Math.ceil(n(x.runAC)*s*3);
      case 'conduit':return Math.ceil((n(x.roofHeight)+n(x.cableExtra)+n(x.runAC))*s);
      case 'one':return 1;
      default:return 0;
    }
  }
  function boq(x,count){
    const cnt=count===undefined?n(x.scenarioPanels):count;
    const lines=(x.materials||[]).map(m=>{
      const manual=m.manual||!m.rule||m.rule==='manual';
      const qty=manual?n(m.qty):autoQty(m.rule,x,cnt);
      return {...m,qty,amount:m.on===false?0:r2(qty*n(m.price))};
    });
    const subtotal=r2(lines.reduce((s,l)=>s+l.amount,0));
    const contingency=x.contingencyOn!==false?r2(subtotal*n(x.contingencyPct)/100):0;
    const iva=x.ivaOn?r2((subtotal+contingency)*n(x.ivaPct,16)/100):0;
    const active=lines.filter(l=>l.on!==false);
    return {lines,subtotal,contingency,iva,total:r2(subtotal+contingency+iva),
      provisional:active.filter(l=>l.status!=='Verificado').length,count:active.length};
  }
  function validate(x){
    const bad=[];
    [['billKwh',0],['periodDays',0],['yield',0],['panelW',0],['panelArea',0]].forEach(([k])=>{if(!(n(x[k])>0))bad.push(k)});
    if(n(x.periodDays)>400)bad.push('periodDays');
    if(!(n(x.scenarioPanels)>=1))bad.push('scenarioPanels');
    return [...new Set(bad)];
  }
  const cell=v=>{const s=String(v===undefined||v===null?'':v);return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  function toCSV(x){
    const b=boq(x),rows=[['Material','Unidad','Cantidad','Precio unitario MXN','Importe MXN','Estado del precio','Fuente URL','Última revisión']];
    b.lines.filter(l=>l.on!==false).forEach(l=>rows.push([l.name,l.unit,l.qty,l.price,l.amount,l.status==='Verificado'?'Verificado':'Referencia editable (provisional)',l.url,l.checked]));
    rows.push([],['Subtotal materiales','','','',b.subtotal]);
    if(x.contingencyOn!==false)rows.push(['Contingencia '+n(x.contingencyPct)+'%','','','',b.contingency]);
    if(x.ivaOn)rows.push(['IVA '+n(x.ivaPct,16)+'%','','','',b.iva]);
    rows.push(['Total estimado','','','',b.total]);
    return '\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
  }
  const M=(id,name,unit,rule,price)=>({id,name,qty:0,unit,rule,manual:false,price,status:'Referencia editable',url:'',checked:'',on:true});
  const factoryCatalog=()=>[
    M('mod','Módulo fotovoltaico monocristalino','pza','panels',2400),
    M('inv','Microinversor / inversor string (potencia según diseño)','pza','one',12500),
    M('est','Estructura de montaje para losa + anclajes','juego','panels',850),
    M('cc','Cable solar DC 6 mm² (ruta + reserva)','m','dcCable',48),
    M('mc4','Conectores MC4 (par)','par','pairs',55),
    M('ca','Cable AC cobre THW-LS (calibre por cálculo)','m','acCable',62),
    M('con','Tubería conduit UV + conectores','m','conduit',45),
    M('pdc','Protección DC (seccionador / fusibles, si aplica)','juego','one',1800),
    M('pac','Protección AC (interruptor termomagnético)','pza','one',650),
    M('tt','Sistema de puesta a tierra y unión equipotencial','juego','one',1600),
    M('cons','Etiquetas, selladores y consumibles eléctricos','lote','one',650)
  ];
  const api={calculate,scenarioStats,autoQty,boq,validate,toCSV,factoryCatalog,RULES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SolarMath=api;
})(globalThis);
