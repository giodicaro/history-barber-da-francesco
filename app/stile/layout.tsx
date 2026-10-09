/* "Il mio stile" è nero dall'alto in basso: anche lo sfondo che l'iPhone
   mostra quando si tira la pagina oltre il bordo. Il body è del layout
   radice (bianco per il sito), quindi lo si cambia solo qui. */

export default function LayoutStile({ children }: LayoutProps<"/stile">) {
  return (
    <>
      <style>{`html,body{background:var(--color-ink)}`}</style>
      {children}
    </>
  );
}
