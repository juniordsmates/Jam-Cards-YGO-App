import { useMemo, useState, type FormEvent } from "react";
import { t } from "../i18n";
import { useCardDb } from "../db/cardStore";
import { lerDeckList } from "../db/decks";
import { blocosParaTexto, salvarGuiaDeck, textoParaBlocos, type GuiaDeckBanco } from "../db/guiasDeck";
import type { Idioma } from "../data/guias";

const IDIOMAS: { id: Idioma; label: string }[] = [
  { id: "pt", label: "Português" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

type Textos = Record<Idioma, { resumo: string; iniciais: string; avancadas: string }>;

/**
 * Guia de Deck (administrador): acrescenta um deck ao guia ou edita um já acrescentado. A deck list
 * (ydke:// ou .ydk) dá o núcleo do deck; os textos de cada idioma usam "## Título" e "- item", com
 * [[Nome da carta]] e **negrito**, como os guias escritos.
 */
export default function FormGuiaDeck({ inicial, onSalvo, onCancelar }: { inicial?: GuiaDeckBanco; onSalvo: (g: GuiaDeckBanco) => void; onCancelar: () => void }) {
  const db = useCardDb();
  const idCanonico = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of db.cards) for (const img of [c.id, ...c.images]) m.set(img, c.id);
    return (id: number) => m.get(id);
  }, [db.cards]);

  const [arquetipo, setArquetipo] = useState(inicial?.arquetipo ?? "");
  const [lista, setLista] = useState(inicial?.lista ?? null);
  const [textoLista, setTextoLista] = useState("");
  const [idioma, setIdioma] = useState<Idioma>("pt");
  const [textos, setTextos] = useState<Textos>(() => {
    const de = (i: Idioma) => ({ resumo: inicial?.textos[i]?.resumo ?? "", iniciais: blocosParaTexto(inicial?.textos[i]?.iniciais), avancadas: blocosParaTexto(inicial?.textos[i]?.avancadas) });
    return { pt: de("pt"), en: de("en"), es: de("es") };
  });
  const [referencias, setReferencias] = useState(inicial?.referencias ?? []);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const lerLista = (texto: string) => {
    setTextoLista(texto);
    if (!texto.trim()) return setMsg(null);
    const { deck, ignorados } = lerDeckList(texto, idCanonico);
    if (!deck.main.length && !deck.extra.length) return setMsg({ tipo: "erro", texto: t("Nenhuma carta reconhecida. Use um arquivo .ydk (#main, #extra, !side) ou um link ydke://.") });
    setLista({ main: deck.main, extra: deck.extra, side: deck.side.slice(0, 15) });
    setMsg({ tipo: "ok", texto: t("Deck list lida: {0} no Main, {1} no Extra e {2} no Side{3}.", [deck.main.length, deck.extra.length, Math.min(deck.side.length, 15), ignorados ? t(" ({0} cartas não reconhecidas)", [ignorados]) : ""]) });
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const nome = arquetipo.trim();
    if (!nome) return;
    setSalvando(true);
    setMsg(null);
    try {
      const prontos: GuiaDeckBanco["textos"] = {};
      for (const { id } of IDIOMAS) {
        const x = textos[id];
        if (x.resumo.trim() || x.iniciais.trim() || x.avancadas.trim()) prontos[id] = { resumo: x.resumo.trim(), iniciais: textoParaBlocos(x.iniciais), avancadas: textoParaBlocos(x.avancadas) };
      }
      const salvo = await salvarGuiaDeck({ arquetipo: nome, lista, textos: prontos, referencias, revisado: new Date().toISOString().slice(0, 10) });
      onSalvo(salvo);
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  };

  const atual = textos[idioma];
  const mudar = (campo: keyof Textos[Idioma], valor: string) => setTextos({ ...textos, [idioma]: { ...atual, [campo]: valor } });

  return (
    <form className="comunidade-form gd-form" onSubmit={(e) => void salvar(e)}>
      <h4>{inicial ? t("Editar deck do guia") : t("Acrescentar deck ao guia")}</h4>
      <label className="field">
        <span className="field-label">{t("Arquétipo (nome em inglês, como no TCG)")}</span>
        <input required maxLength={80} value={arquetipo} disabled={!!inicial} onChange={(e) => setArquetipo(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">{t("Deck list (link ydke:// ou conteúdo do .ydk)")}</span>
        <textarea rows={3} value={textoLista} onChange={(e) => lerLista(e.target.value)} placeholder="ydke://…" />
      </label>
      <p className="tags-note">
        {lista
          ? t("Deck list atual: {0} no Main, {1} no Extra e {2} no Side. Ela vira o núcleo do deck no guia.", [lista.main.length, lista.extra.length, lista.side.length])
          : t("Sem deck list: o guia mostra só os textos e as referências.")}
      </p>
      <div className="format-switch" role="radiogroup" aria-label={t("Idioma do texto")}>
        {IDIOMAS.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={idioma === x.id} className={idioma === x.id ? "active" : ""} onClick={() => setIdioma(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field-label">{t("Resumo")}</span>
        <textarea rows={3} maxLength={2000} value={atual.resumo} onChange={(e) => mudar("resumo", e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">{t("Ideias Iniciais")}</span>
        <textarea rows={8} value={atual.iniciais} onChange={(e) => mudar("iniciais", e.target.value)} placeholder={"## Como o deck funciona\n- [[Nome da carta]] busca…"} />
      </label>
      <label className="field">
        <span className="field-label">{t("Ideias Avançadas")}</span>
        <textarea rows={8} value={atual.avancadas} onChange={(e) => mudar("avancadas", e.target.value)} />
      </label>
      <p className="tags-note">{t("Cada bloco começa com \"## Título\" e cada item com \"- \". Use [[Nome da carta em inglês]] para a carta com prévia e **texto** para negrito. Os idiomas sem texto ficam com o aviso de guia ainda não escrito.")}</p>
      {referencias.length > 0 && (
        <div className="field">
          <span className="field-label">{t("Referências")}</span>
          <ul className="gd-referencias">
            {referencias.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.titulo}
                </a>{" "}
                <small>· {r.site}</small>{" "}
                <button type="button" className="link-btn" onClick={() => setReferencias(referencias.filter((x) => x.url !== r.url))}>
                  {t("Remover")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      <div className="dialog-actions">
        <button className="ghost-btn" type="button" onClick={onCancelar}>
          {t("Cancelar")}
        </button>
        <button className="ghost-btn" type="submit" disabled={salvando || !arquetipo.trim()}>
          {salvando ? t("Salvando…") : t("Salvar")}
        </button>
      </div>
    </form>
  );
}
