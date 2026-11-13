export function initializeArenaFullscreen() {
  const arena=document.getElementById("battle"),button=document.getElementById("arena-fullscreen");
  if(!arena||!button)return;
  function sync() {
    const active=document.fullscreenElement===arena||arena.classList.contains("arena-expanded");
    button.setAttribute("aria-pressed",String(active));
    button.textContent=active?"×":"⛶ Tela cheia";
    button.setAttribute("aria-label",active?"Sair da tela cheia":"Expandir arena em tela cheia");
    button.title=active?"Sair da tela cheia":"Expandir arena em tela cheia";
    document.body.classList.toggle("arena-fullscreen-open",active);
    document.documentElement.classList.toggle("arena-playing-fullscreen",active&&arena.querySelector(".battlefield"));
  }
  button.addEventListener("click",async()=>{
    try {
      if(document.fullscreenElement===arena)await document.exitFullscreen();
      else if(arena.classList.contains("arena-expanded"))arena.classList.remove("arena-expanded");
      else if(arena.requestFullscreen){await arena.requestFullscreen();}
      else arena.classList.add("arena-expanded");
    } catch { arena.classList.toggle("arena-expanded"); }
    sync();
  });
  document.addEventListener("nativa:combat-start",()=>{arena.classList.add("arena-expanded");arena.scrollTop=0;sync();document.querySelector('#battle-arena')?.focus({preventScroll:true});});
  document.addEventListener("nativa:combat-close",()=>{arena.classList.remove("arena-expanded");if(document.fullscreenElement===arena)void document.exitFullscreen().catch(()=>{});sync();});
  document.addEventListener("fullscreenchange",sync);
  document.addEventListener("keydown",event=>{if(event.key==="Escape"){arena.classList.remove("arena-expanded");sync();}});
  window.addEventListener("orientationchange",sync);
}
