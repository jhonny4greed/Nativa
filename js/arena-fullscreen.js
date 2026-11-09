export function initializeArenaFullscreen() {
  const arena=document.getElementById("battle"),button=document.getElementById("arena-fullscreen");
  if(!arena||!button)return;
  function sync() {
    const active=document.fullscreenElement===arena||arena.classList.contains("arena-expanded");
    button.setAttribute("aria-pressed",String(active));
    button.textContent=active?"Sair da tela cheia":"⛶ Tela cheia";
    document.body.classList.toggle("arena-fullscreen-open",active);
  }
  button.addEventListener("click",async()=>{
    try {
      if(document.fullscreenElement===arena)await document.exitFullscreen();
      else if(arena.classList.contains("arena-expanded"))arena.classList.remove("arena-expanded");
      else if(arena.requestFullscreen)await arena.requestFullscreen();
      else arena.classList.add("arena-expanded");
    } catch { arena.classList.toggle("arena-expanded"); }
    sync();
  });
  document.addEventListener("fullscreenchange",sync);
  document.addEventListener("keydown",event=>{if(event.key==="Escape"){arena.classList.remove("arena-expanded");sync();}});
}
