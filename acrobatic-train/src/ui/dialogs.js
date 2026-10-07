/** One active overlay, inert background, Tab trap and focus return. */
export class Dialogs {
  constructor(root) {
    this.root = root; this.active = null; this.returnFocus = null;
    this.onKeyDown = event => {
      if (event.key !== 'Tab' || !this.active) return;
      const buttons = [...this.active.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => !el.closest('[hidden]'));
      if (!buttons.length) { event.preventDefault(); return; }
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', this.onKeyDown);
  }
  sync() {
    const top = [...this.root.querySelectorAll('.overlay-modal')].filter(el => !el.hidden).at(-1) || null;
    for (const child of this.root.children) child.inert = Boolean(top && child !== top);
    if (top !== this.active) {
      if (!this.active && top) this.returnFocus = document.activeElement;
      this.active = top;
      if (top) {
        top.setAttribute('role', 'dialog'); top.setAttribute('aria-modal', 'true');
        const heading = top.querySelector('h1, h2');
        if (heading) {
          if (!heading.id) heading.id = `${top.id}-title`;
          top.setAttribute('aria-labelledby', heading.id);
        }
        [...top.querySelectorAll('button:not(:disabled)')].find(button => !button.closest('[hidden]'))?.focus();
      } else if (this.returnFocus?.isConnected && !this.returnFocus.closest('[hidden]')) this.returnFocus.focus();
    }
  }
  dispose() { document.removeEventListener('keydown', this.onKeyDown); }
}
