
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "redirectTo": "/dashboard",
    "route": "/"
  },
  {
    "renderMode": 1,
    "route": "/login"
  },
  {
    "renderMode": 1,
    "route": "/alterar-password-inicial"
  },
  {
    "renderMode": 1,
    "route": "/configurar-clube"
  },
  {
    "renderMode": 1,
    "route": "/dados-pessoais"
  },
  {
    "renderMode": 1,
    "redirectTo": "/dados-pessoais",
    "route": "/completar-perfil"
  },
  {
    "renderMode": 1,
    "redirectTo": "/dados-pessoais",
    "route": "/dados-funcionario"
  },
  {
    "renderMode": 1,
    "route": "/dashboard"
  },
  {
    "renderMode": 1,
    "route": "/perfil"
  },
  {
    "renderMode": 1,
    "route": "/definicoes"
  },
  {
    "renderMode": 1,
    "redirectTo": "/dashboard",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 5951, hash: '498d5656779a0f42aa2ae4220a9d82c15560779e59fd795e02b89ef527f6e839', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 956, hash: 'f5c21510fe03e3b3f65396ec8b7b40d750e724882bfe4823c882e354a755973e', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-AI4LXEMK.css': {size: 232658, hash: 'cDVsguNLQcE', text: () => import('./assets-chunks/styles-AI4LXEMK_css.mjs').then(m => m.default)}
  },
};
