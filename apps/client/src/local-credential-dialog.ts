export interface LocalCredentialInput {
  readonly username: string;
  readonly password: string;
}

export type LocalCredentialMode = 'login' | 'register';

let activeCleanup: (() => void) | null = null;

function applyInputStyle(input: HTMLInputElement): void {
  Object.assign(input.style, {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '46px',
    padding: '10px 12px',
    border: '1px solid #64758a',
    borderRadius: '4px',
    background: '#111822',
    color: '#f3f6fa',
    font: '16px "Noto Sans KR", "Malgun Gothic", sans-serif',
    outline: 'none',
  });
}

function makeButton(label: string, primary: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  Object.assign(button.style, {
    flex: '1 1 0',
    minHeight: '46px',
    border: `1px solid ${primary ? '#8caed0' : '#5d6877'}`,
    borderRadius: '4px',
    background: primary ? '#35506b' : '#222b37',
    color: '#f3f6fa',
    font: '600 15px "Noto Sans KR", "Malgun Gothic", sans-serif',
    cursor: 'pointer',
  });
  return button;
}

export function closeLocalCredentialDialog(): void {
  activeCleanup?.();
  activeCleanup = null;
}

export function requestLocalCredentials(mode: LocalCredentialMode): Promise<LocalCredentialInput | null> {
  closeLocalCredentialDialog();
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.dataset.frontlineLocalCredentialDialog = 'true';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '10050',
      display: 'grid',
      placeItems: 'center',
      padding: '20px',
      background: 'rgba(5, 8, 12, 0.78)',
      backdropFilter: 'blur(2px)',
    });

    const form = document.createElement('form');
    Object.assign(form.style, {
      width: 'min(420px, calc(100vw - 36px))',
      boxSizing: 'border-box',
      padding: '24px',
      border: '1px solid #65768b',
      borderRadius: '6px',
      background: '#18202b',
      boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
      color: '#f3f6fa',
      fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif',
    });

    const title = document.createElement('h2');
    title.textContent = mode === 'register' ? '아이디 만들기' : '아이디 로그인';
    Object.assign(title.style, { margin: '0 0 8px', fontSize: '24px' });
    const help = document.createElement('p');
    help.textContent = mode === 'register'
      ? '아이디 4~24자 · 영문 소문자/숫자/_ · 비밀번호 10자 이상'
      : 'Frontline Summoners 자체 계정으로 로그인합니다.';
    Object.assign(help.style, { margin: '0 0 18px', color: '#aeb9c7', fontSize: '13px', lineHeight: '1.5' });

    const username = document.createElement('input');
    username.type = 'text';
    username.name = 'username';
    username.placeholder = '아이디';
    username.autocomplete = 'username';
    username.maxLength = 24;
    username.pattern = '[A-Za-z0-9_]{4,24}';
    username.required = true;
    username.setAttribute('aria-label', '아이디');
    applyInputStyle(username);

    const password = document.createElement('input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = '비밀번호';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    password.minLength = 10;
    password.maxLength = 128;
    password.required = true;
    password.setAttribute('aria-label', '비밀번호');
    applyInputStyle(password);
    password.style.marginTop = '10px';

    const confirm = mode === 'register' ? document.createElement('input') : null;
    if (confirm) {
      confirm.type = 'password';
      confirm.name = 'password-confirm';
      confirm.placeholder = '비밀번호 확인';
      confirm.autocomplete = 'new-password';
      confirm.minLength = 10;
      confirm.maxLength = 128;
      confirm.required = true;
      confirm.setAttribute('aria-label', '비밀번호 확인');
      applyInputStyle(confirm);
      confirm.style.marginTop = '10px';
    }

    const error = document.createElement('div');
    Object.assign(error.style, { minHeight: '20px', marginTop: '10px', color: '#ffaaa3', fontSize: '13px' });

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '10px', marginTop: '8px' });
    const cancel = makeButton('취소', false);
    const submit = makeButton(mode === 'register' ? '아이디 생성' : '로그인', true);
    submit.type = 'submit';
    actions.append(cancel, submit);

    form.append(title, help, username, password);
    if (confirm) form.append(confirm);
    form.append(error, actions);
    overlay.append(form);
    document.body.append(overlay);

    let settled = false;
    const finish = (value: LocalCredentialInput | null) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown, true);
      if (activeCleanup === cleanup) activeCleanup = null;
      resolve(value);
    };
    const cleanup = () => finish(null);
    activeCleanup = cleanup;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null);
    };
    document.addEventListener('keydown', onKeyDown, true);

    cancel.addEventListener('click', () => finish(null));
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) finish(null);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const normalizedUsername = username.value.trim().toLowerCase();
      if (!/^[a-z0-9_]{4,24}$/.test(normalizedUsername)) {
        error.textContent = '아이디 형식을 확인해 주세요.';
        username.focus();
        return;
      }
      if (password.value.length < 10 || password.value.length > 128) {
        error.textContent = '비밀번호는 10~128자로 입력하세요.';
        password.focus();
        return;
      }
      if (confirm && password.value !== confirm.value) {
        error.textContent = '비밀번호 확인이 일치하지 않습니다.';
        confirm.focus();
        return;
      }
      finish({ username: normalizedUsername, password: password.value });
    });

    window.setTimeout(() => username.focus(), 0);
  });
}
