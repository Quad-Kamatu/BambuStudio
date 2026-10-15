"""Adapt the full-window design concept to Arcwright's inline chat frame."""
from pathlib import Path

source = Path(__file__).with_name('index.html').read_text()
adaptation = '''<style>
html,body{background:transparent}
body{color:var(--foreground,#f0f3f7)}
main.wrap{padding:0;max-width:none}
.concept-bar{background:transparent;border:0}
.concept-bar .wrap{padding:0 0 .75rem;justify-content:flex-start}
.concept-bar .wrap>div:first-child{display:none}
#concept{background:var(--base);color:var(--ink);padding:1rem;border-radius:var(--radius)}
.workspace-head{padding:.25rem 0 1rem;gap:.75rem}
.workspace-head h1{font-size:1.7rem}
.workspace-head p{font-size:.875rem;margin-top:.3rem}
.head-actions{gap:.65rem}
.slots{gap:.6rem;margin-bottom:1.1rem}
.slot{padding:.8rem;gap:.6rem}
.slot-name{font-size:1rem}
.inventory-layout{gap:1rem}
.table-shell td{padding:.6rem}
.row-name{gap:.5rem}
.row-meta{margin-top:.12rem}
.detail-top,.detail-section{padding:1rem}
.detail-label{margin-bottom:.3rem}
.weight-big{font-size:1.7rem}
.detail .bar{margin:.65rem 0 .45rem}
.detail button.full{margin-top:.7rem}
.detail dl{gap:.4rem}
#plan{color:var(--foreground,#f0f3f7);padding:1rem}
#plan p,#plan ul,#plan ol{color:inherit}
#plan .plan-card,#plan .table-shell{color:var(--ink)}
.plan-caption{color:var(--ink)}
@media(min-width:640px){
 .slots{grid-template-columns:repeat(4,minmax(0,1fr))}
 .slot{grid-template-columns:1fr;text-align:left}
 .slot .spool{position:static;width:2.5rem;height:2.5rem}
 .slot-name{padding-right:0}
 .slot-meta{font-size:.875rem}
 .inventory-layout{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}
 .location-column{display:none}
 .roll-column{width:55%}.stock-column{width:45%}
 .row-name .spool{display:none}
 .detail{position:sticky;top:1rem}
 .slot-mass{flex-wrap:wrap}
}
@media(min-width:1024px){
 .slots .slot{grid-template-columns:auto minmax(0,1fr)}
 .location-column{display:table-cell}
 .roll-column{width:43%}.stock-column{width:34%}
 .row-name .spool{display:block}
 .inventory-layout{grid-template-columns:minmax(0,2fr) minmax(18rem,1fr)}
}
</style>'''
source = source.replace('</head>', adaptation + '</head>')
source = source.replace("matchMedia('(min-width:1024px)')", "matchMedia('(min-width:640px)')")
source = source.replace('<p class="muted">Physical rolls and AMS assignments.</p>', '<p class="muted">Interactive proposal. Sample data only.</p>')
Path(__file__).with_name('inline.html').write_text(source)
