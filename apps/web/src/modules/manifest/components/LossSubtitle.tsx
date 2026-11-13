import { textoDoPrejuizo } from "../texts";

/** "código 13" sob o título da coluna de prejuízo. */
export function PrejuizoSubtitulo({ codigos }: { codigos?: readonly number[] | undefined }) {
  return (
    <span className="block text-[12px] font-normal tracking-normal normal-case">
      {textoDoPrejuizo(codigos)}
    </span>
  );
}
