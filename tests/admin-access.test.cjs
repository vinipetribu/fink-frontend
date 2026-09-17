/* eslint-disable @typescript-eslint/no-require-imports -- Node.js CommonJS test and TypeScript source loader. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sessionKey = ['session', 'validate'];
const profileKey = (id) => ['pessoas', 'detail', id];

// Exercise the actual hooks/components and React Query cache with simulated
// backend responses. Capture effects/hydration without adding a DOM library.
function setup({ token = null, hydrated = true, stored = {} } = {}) {
  const previousWindow = global.window;
  const values = { ...stored, ...(token ? { authToken: token } : {}) };
  global.window = { localStorage: { getItem: (key) => values[key] ?? null } };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const effects = [];
  const redirects = [];
  const modules = new Map();
  let contentRenders = 0;
  let headerRenders = 0;
  const router = {
    push: (url) => redirects.push(url),
    replace: (url) => redirects.push(url),
  };
  const mocks = {
    react: {
      ...React,
      useEffect: (effect) => effects.push(effect),
      useSyncExternalStore: (_, clientSnapshot, serverSnapshot) =>
        hydrated ? clientSnapshot() : serverSnapshot(),
    },
    'next/navigation': {
      useRouter: () => router,
      usePathname: () => '/admin/pessoas',
    },
    'next/link': ({ children, ...props }) =>
      React.createElement('a', props, children),
    '@/components/Header': {
      Header: () => {
        headerRenders += 1;
        return React.createElement('header', null, 'ADMIN_HEADER');
      },
    },
  };

  function load(base) {
    const filename = [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      path.join(base, 'index.ts'),
    ].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!filename) throw new Error(`Missing source module: ${base}`);
    if (modules.has(filename)) return modules.get(filename).exports;
    const loaded = { exports: {} };
    modules.set(filename, loaded);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const sourceRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/')) return load(path.join(root, name.slice(2)));
      if (name.startsWith('.'))
        return load(path.resolve(path.dirname(filename), name));
      return require(name);
    };
    new Function('require', 'module', 'exports', 'localStorage', compiled)(
      sourceRequire,
      loaded,
      loaded.exports,
      global.window.localStorage
    );
    return loaded.exports;
  }

  const { ProtectedRoute } = load(
    path.join(root, 'components/auth/ProtectedRoute')
  );
  const { Navbar } = load(path.join(root, 'components/shared/Navbar'));
  const AdminLayout = load(path.join(root, 'app/admin/layout')).default;
  const Content = () => {
    contentRenders += 1;
    return React.createElement('section', null, 'ADMIN_CONTENT');
  };
  function render(element) {
    effects.length = 0;
    redirects.length = 0;
    const html = renderToStaticMarkup(
      React.createElement(QueryClientProvider, { client }, element)
    );
    effects.forEach((effect) => effect());
    return html;
  }
  return {
    client,
    redirects,
    get contentRenders() {
      return contentRenders;
    },
    get headerRenders() {
      return headerRenders;
    },
    set hydrated(value) {
      hydrated = value;
    },
    session(id) {
      client.setQueryData(sessionKey, {
        fk_pessoa_id_pessoa: id,
        id_sessao: 1,
      });
    },
    profile(id, admin) {
      client.setQueryData(profileKey(id), { id_pessoa: id, admin });
    },
    admin: () =>
      render(
        React.createElement(AdminLayout, null, React.createElement(Content))
      ),
    regular: () =>
      render(
        React.createElement(ProtectedRoute, null, React.createElement(Content))
      ),
    navbar: () => render(React.createElement(Navbar)),
    adminPage() {
      const Page = load(path.join(root, 'app/admin/pessoas/page')).default;
      return render(
        React.createElement(AdminLayout, null, React.createElement(Page))
      );
    },
    close() {
      client.clear();
      if (previousWindow === undefined) delete global.window;
      else global.window = previousWindow;
    },
  };
}

test('Visitante: acesso direto vai para login; navbar e conteúdo ficam ocultos', () => {
  const ui = setup();
  try {
    assert.equal(ui.admin(), '');
    assert.deepEqual(ui.redirects, ['/login']);
    assert.equal(ui.contentRenders, 0);
    assert.equal(ui.headerRenders, 0);
    assert.ok(!ui.navbar().includes('Administração'));
  } finally {
    ui.close();
  }
});

test('USER: acesso direto vai para home e Administração não aparece no menu', () => {
  const ui = setup({ token: 'fictitious-user-token' });
  try {
    ui.session('user-id');
    ui.profile('user-id', false);
    assert.equal(ui.admin(), '');
    assert.deepEqual(ui.redirects, ['/home']);
    assert.equal(ui.contentRenders, 0);
    assert.equal(ui.headerRenders, 0);
    const menu = ui.navbar();
    assert.ok(!menu.includes('Administração'));
    assert.ok(menu.includes('Espaço Finker'));
    assert.ok(menu.includes('Movimentações'));
    assert.ok(ui.regular().includes('ADMIN_CONTENT'));
  } finally {
    ui.close();
  }
});

test('ADMIN: menu, acesso direto, listar pessoas e Logs de Segurança disponíveis', () => {
  const ui = setup({ token: 'fictitious-admin-token' });
  try {
    ui.session('admin-id');
    ui.profile('admin-id', true);
    assert.ok(ui.navbar().includes('href="/admin/pessoas"'));
    assert.ok(ui.navbar().includes('Administração'));
    assert.ok(ui.admin().includes('ADMIN_CONTENT'));
    assert.deepEqual(ui.redirects, []);
    ui.client.setQueryData(['security-logs'], []);
    const page = ui.adminPage();
    assert.ok(page.includes('Listar pessoas'));
    assert.ok(page.includes('Logs de Segurança'));
    assert.ok(page.includes('Atualizar logs'));
  } finally {
    ui.close();
  }
});

for (const admin of [false, true]) {
  test(`Reload ${admin ? 'ADMIN' : 'USER'}: nenhum conteúdo até validar sessão e perfil`, () => {
    const ui = setup({ token: 'fictitious-token', hydrated: false });
    try {
      assert.ok(!ui.admin().includes('ADMIN_CONTENT'));
      assert.deepEqual(ui.redirects, []);
      ui.hydrated = true;
      assert.ok(!ui.admin().includes('ADMIN_CONTENT'));
      assert.ok(!ui.navbar().includes('Administração'));
      assert.deepEqual(ui.redirects, []);
      ui.session('current-id');
      assert.ok(!ui.admin().includes('ADMIN_CONTENT'));
      assert.deepEqual(ui.redirects, []);
      assert.equal(ui.contentRenders, 0);
      assert.equal(ui.headerRenders, 0);
      ui.profile('current-id', admin);
      assert.equal(ui.admin().includes('ADMIN_CONTENT'), admin);
      assert.deepEqual(ui.redirects, admin ? [] : ['/home']);
      assert.equal(ui.navbar().includes('Administração'), admin);
    } finally {
      ui.close();
    }
  });
}

test('admin/userId arbitrários no localStorage não concedem acesso', () => {
  const ui = setup({
    token: 'fictitious-user-token',
    stored: { admin: 'true', userId: 'forged-admin-id' },
  });
  try {
    ui.session('validated-user-id');
    ui.profile('validated-user-id', false);
    ui.profile('forged-admin-id', true);
    assert.equal(ui.admin(), '');
    assert.deepEqual(ui.redirects, ['/home']);
    assert.ok(!ui.navbar().includes('Administração'));
  } finally {
    ui.close();
  }
});

test('Sem token: sessão/perfil antigos em cache não concedem acesso', () => {
  const ui = setup();
  try {
    ui.session('old-admin-id');
    ui.profile('old-admin-id', true);
    assert.equal(ui.admin(), '');
    assert.deepEqual(ui.redirects, ['/login']);
    assert.ok(!ui.navbar().includes('Administração'));
  } finally {
    ui.close();
  }
});

test('Revalidação de perfil: ADMIN em cache fica oculto até a resposta atual', () => {
  const ui = setup({ token: 'fictitious-token' });
  try {
    ui.session('current-id');
    ui.profile('current-id', true);
    ui.client
      .getQueryCache()
      .find({ queryKey: profileKey('current-id') })
      .setState({ fetchStatus: 'fetching' });
    assert.ok(!ui.admin().includes('ADMIN_CONTENT'));
    assert.ok(!ui.navbar().includes('Administração'));
    assert.deepEqual(ui.redirects, []);
    ui.profile('current-id', false);
    ui.client
      .getQueryCache()
      .find({ queryKey: profileKey('current-id') })
      .setState({ fetchStatus: 'idle' });
    assert.equal(ui.admin(), '');
    assert.deepEqual(ui.redirects, ['/home']);
  } finally {
    ui.close();
  }
});

test('Falha de perfil não libera ADMIN em cache', () => {
  const ui = setup({ token: 'fictitious-token' });
  try {
    ui.session('current-id');
    ui.profile('current-id', true);
    ui.client
      .getQueryCache()
      .find({ queryKey: profileKey('current-id') })
      .setState({
        status: 'error',
        error: new Error('Profile unavailable'),
        fetchStatus: 'idle',
      });
    assert.equal(ui.admin(), '');
    assert.deepEqual(ui.redirects, ['/home']);
    assert.ok(!ui.navbar().includes('Administração'));
  } finally {
    ui.close();
  }
});
