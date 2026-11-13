// O jsdom não tem ResizeObserver; os componentes do Radix (Switch, Popover) medem com ele.
class ResizeObserverFalso {
  observe(): void {
    // nada a medir no jsdom
  }
  unobserve(): void {
    // nada a medir no jsdom
  }
  disconnect(): void {
    // nada a medir no jsdom
  }
}

globalThis.ResizeObserver = ResizeObserverFalso;
