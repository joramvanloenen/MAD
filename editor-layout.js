// Responsive artwork workstation for MAD.
// Rearranges the existing controls without cloning them, preserving all
// existing event handlers, input IDs and artwork state.
const el=id=>document.getElementById(id);
const make=(tag,cls,text)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text)n.textContent=text;
  return n;
};
function move(parent,...children){for(const c of children)if(c)parent.append(c)}
function labelOf(id){return document.querySelector('#editor label[for="'+id+'"]')}
function pairedGroup(node){
  const wrap=make('div','editorFieldGroup');
  node.parentNode.insertBefore(wrap,node);
  const label=node.previousElementSibling;
  if(label?.tagName==='LABEL')wrap.append(label);
  wrap.append(node);
  return wrap;
}
function makePaintToolGroup(){
  const paint=el('paintPanel'),tools=el('paintTools');
  if(!paint||!tools)return;
  const target=el('editorToolsPane');
  const group=make('div','editorToolGroup');
  group.dataset.editorTool='painting';
  group.append(tools);
  const action=paint.querySelector('.toolrow');
  if(action)group.append(action);
  target.append(group);
}
function makeVoxelToolGroup(){
  const pane=el('voxelPanel'),target=el('editorToolsPane');
  const controls=pane?.querySelector('.toolrow');
  if(!controls)return;
  const group=make('div','editorToolGroup');
  group.dataset.editorTool='voxel';
  group.append(controls);
  target.append(group);
}
function setupMixedSections(){
  const mixed=el('mixedPanel');
  if(!mixed)return;
  const groups=[
    ['materials','Materials'],['assemble','Assemble'],
    ['transform','Transform'],['paint','Paint'],['cloth','Cloth']
  ];
  const selectors={};
  for(const [id] of groups){
    selectors[id]=make('section','atelierSection');
    selectors[id].dataset.atelierSection=id;
  }
  const materialRow=el('mixedAddRow');
  move(selectors.materials,materialRow.previousElementSibling,materialRow);
  const toolRow=el('mixedToolRow');
  const assemblyRow=el('mixedDuplicate').parentElement;
  move(selectors.assemble,toolRow,assemblyRow);
  const cut=el('mixedCut');
  move(selectors.assemble,labelOf('mixedCut'),cut.parentElement);
  const baseColor=el('mixedPartColor');
  move(selectors.paint,labelOf('mixedPartColor'),baseColor);
  const paintColor=el('mixedPaintColor');
  move(selectors.paint,labelOf('mixedPaintColor'),paintColor.parentElement);
  const pos=el('mixedPosX'),rot=el('mixedRotX');
  const posRow=pos.parentElement,rotRow=rot.parentElement;
  const posLabel=posRow.previousElementSibling;
  const rotLabel=rotRow.previousElementSibling;
  const scale=el('mixedScale');
  move(selectors.transform,posLabel,posRow,rotLabel,rotRow,
    labelOf('mixedScale'),scale);
  const drape=el('mixedDrape'),bake=el('mixedBake');
  move(selectors.cloth,drape.parentElement,bake.parentElement);
  // Selection lives above all categories to make switching parts effortless.
  const select=el('mixedParts');
  const common=make('div','atelierSelection');
  move(common,labelOf('mixedParts'),select);
  const tabs=make('nav','atelierTabs');
  tabs.setAttribute('aria-label','Mixed-media tools');
  for(const [id,label] of groups){
    const b=make('button','atelierTab',label);
    b.type='button';b.dataset.atelierTab=id;
    b.setAttribute('aria-pressed',id==='materials'?'true':'false');
    b.addEventListener('click',()=>setAtelierSection(id));
    tabs.append(b);
  }
  // Original title and descriptive copy stay in DOM but have no impact on
  // the editor's mobile panel height.
  const feedback=el('mixedFeedback');
  mixed.prepend(tabs);mixed.prepend(common);
  for(const [id] of groups)mixed.insertBefore(selectors[id],feedback);
  setAtelierSection('materials');
}
export function setAtelierSection(name){
  for(const panel of document.querySelectorAll('#mixedPanel [data-atelier-section]'))
    panel.classList.toggle('hidden',panel.dataset.atelierSection!==name);
  for(const tab of document.querySelectorAll('#mixedPanel [data-atelier-tab]')){
    const active=tab.dataset.atelierTab===name;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-pressed',String(active));
  }
}
export function setEditorPane(name){
  const editor=el('editor');
  editor.dataset.pane=name;
  for(const pane of editor.querySelectorAll('[data-editor-pane-content]'))
    pane.classList.toggle('hidden',pane.dataset.editorPaneContent!==name);
  for(const btn of editor.querySelectorAll('[data-editor-pane]')){
    const active=btn.dataset.editorPane===name;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  }
}
export function syncEditorToolMode(mode){
  const editor=el('editor');
  editor.dataset.mode=mode;
  for(const group of editor.querySelectorAll('[data-editor-tool]'))
    group.classList.toggle('hidden',group.dataset.editorTool!==mode);
  if(mode==='mixed')setAtelierSection(
    document.querySelector('#mixedPanel .atelierTab.active')?.dataset.atelierTab||'materials');
}
export function installArtworkEditorLayout(){
  const editor=el('editor'),modal=editor.querySelector('.modal');
  if(editor.dataset.layoutReady==='1')return;
  editor.dataset.layoutReady='1';
  modal.classList.add('editorShell');
  const close=modal.querySelector('[data-close="editor"]');
  const heading=modal.querySelector('h1');
  const spot=el('spotLabel');
  const rule=el('editorRule');
  const modes=modal.querySelector('.tabrow');
  const grid=modal.querySelector('.editorGrid');
  const left=grid.children[0],right=grid.children[1];
  left.classList.add('editorWorkspace');
  right.classList.add('editorInspector');

  // The title, location and close control form a permanently visible header.
  const header=make('header','editorHeader');
  const headingGroup=make('div','editorHeading');
  const overline=make('span','editorOverline','MAD  /  CREATE');
  move(headingGroup,overline,heading,spot);
  move(header,headingGroup,close);
  modal.prepend(header);
  modes.classList.add('editorModeTabs');
  modes.setAttribute('aria-label','Choose artwork technique');
  rule.classList.add('editorRule');

  const tabs=make('nav','editorInspectorTabs');
  tabs.setAttribute('aria-label','Editor controls');
  for(const [id,title] of [['tools','Create'],['look','Appearance'],['details','Artwork info']]){
    const button=make('button','editorInspectorTab',title);
    button.type='button';button.dataset.editorPane=id;
    button.addEventListener('click',()=>setEditorPane(id));
    tabs.append(button);
  }
  right.prepend(tabs);
  const tools=make('section','editorInspectorPane');
  tools.id='editorToolsPane';tools.dataset.editorPaneContent='tools';
  const appearance=make('section','editorInspectorPane');
  appearance.id='editorLookPane';appearance.dataset.editorPaneContent='look';
  const details=make('section','editorInspectorPane');
  details.id='editorDetailsPane';details.dataset.editorPaneContent='details';
  move(right,tools,appearance,details);

  const artist=el('artist'),title=el('artTitle'),desc=el('artDesc');
  move(details,artist.previousElementSibling,artist,
    title.previousElementSibling,title,desc.previousElementSibling,desc);

  move(tools,el('shapePanel'),el('mixedPanel'));
  makePaintToolGroup();
  const clay=el('clayTools');
  clay.dataset.editorTool='clay';
  tools.append(clay);
  makeVoxelToolGroup();

  const painting=el('paintingOptions'),sculpture=el('sculptureOptions');
  const scale=el('artScale'),swatches=el('swatches'),brush=el('brushSize');
  move(appearance,painting,sculpture,
    scale.previousElementSibling,scale,
    swatches.previousElementSibling,swatches,
    brush.previousElementSibling,brush);
  const info=right.querySelector('.notice');
  if(info)info.classList.add('editorStorageNote');
  if(info)appearance.append(info);

  const footer=make('footer','editorFooter');
  const publish=el('publish'),hint=el('publishHint');
  const detailsAction=make('button','editorQuickDetails','Artwork info');
  detailsAction.type='button';
  detailsAction.addEventListener('click',()=>setEditorPane('details'));
  footer.append(detailsAction,hint,publish);
  modal.append(footer);

  setupMixedSections();
  setEditorPane('tools');
  syncEditorToolMode('painting');
  // The right column now contains panes only. The actual canvas is always
  // rendered by its original WebGL/2D renderer within the flexible stage.
}
