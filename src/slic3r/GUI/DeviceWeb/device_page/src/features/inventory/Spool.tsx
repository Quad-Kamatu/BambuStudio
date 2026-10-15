import { useId } from "react";
export function Spool({color, empty = false}: {color: string; empty?: boolean}) {
const key = "roll" + useId().replace(/:/g, "");
return (<svg className="inventory-spool" viewBox="0 0 100 100" aria-hidden="true" style={{ opacity: empty ? .42 : 1 }}>
 <defs>
 <linearGradient id={`${key}-back`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#aeb9c6"/><stop offset=".38" stopColor="#747f8d"/><stop offset="1" stopColor="#3b4552"/></linearGradient>
 <linearGradient id={`${key}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d4dde6"/><stop offset=".38" stopColor="#9da9b8"/><stop offset=".72" stopColor="#697788"/><stop offset="1" stopColor="#bac6d3"/></linearGradient>
 <linearGradient id={`${key}-shade`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".3"/><stop offset=".3" stopColor="#fff" stopOpacity=".03"/><stop offset=".7" stopColor="#000" stopOpacity=".05"/><stop offset="1" stopColor="#000" stopOpacity=".38"/></linearGradient>
 <radialGradient id={`${key}-hole`} cx=".35" cy=".28" r=".9"><stop stopColor="#303c49"/><stop offset=".6" stopColor="#111923"/><stop offset="1" stopColor="#070b11"/></radialGradient>
 <clipPath id={`${key}-wind`}><path d="M32 17C10 17 10 83 32 83H65V17Z"/></clipPath>
 </defs>
 <ellipse cx="51" cy="92" rx="35" ry="3" fill="#000" opacity=".25"/>
 <ellipse cx="32" cy="50" rx="26" ry="41" fill={`url(#${key}-back)`} stroke="#c3cedb" strokeOpacity=".4" strokeWidth="1.2"/>
 <ellipse cx="32" cy="50" rx="21" ry="35" fill="#323e4a"/>
 <path d="M32 17C10 17 10 83 32 83H65V17Z" fill={`${color}`}/>
 <g clipPath={`url(#${key}-wind)`} fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth=".85">{Array.from({length: 17}, (_, i) => <path key={i} d={`M16 ${20+i*3.7}H65`}/>)}</g>
 <path d="M32 17C10 17 10 83 32 83H65V17Z" fill={`url(#${key}-shade)`}/>
 <path d="M20 17C9 30 9 69 20 83" fill="none" stroke="#ecf2f7" strokeOpacity=".22" strokeWidth="1.4"/>
 <g transform="translate(64 50) scale(.72 1)">
 <circle r="41" fill={`url(#${key}-edge)`} stroke="#ced9e6" strokeOpacity=".6" strokeWidth="1.2"/>
 <circle r="36.2" fill="#344150"/>
 <circle r="33.5" fill={`${color}`}/>
 <circle r="33.5" fill={`url(#${key}-shade)`}/>
 <g fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth=".85">{[17.5,20.5,23.5,26.5,29.5,32].map(radius => <circle key={radius} r={radius}/>)}</g>
 <g fill="none" stroke={`url(#${key}-edge)`} strokeWidth="7" strokeLinecap="round"><path d="M12 0H35"/><path d="M-6 10.39L-17.5 30.31"/><path d="M-6 -10.39L-17.5 -30.31"/></g>
 <circle r="15" fill={`url(#${key}-edge)`}/><circle r="10.2" fill="#425060"/><circle r="8" fill={`url(#${key}-hole)`} stroke="#e1e8f0" strokeOpacity=".38" strokeWidth="1"/>
 <path d="M-26 -29C-10 -42 17 -40 30 -25" fill="none" stroke="#f6f9fc" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round"/>
 <path d="M-29 27C-13 41 13 42 29 29" fill="none" stroke="#253445" strokeOpacity=".5" strokeWidth="1.5"/>
 </g></svg>);
}
