# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.


React libraries
- Vite for client side SPA
- NPM for package management
- Zustand for global state management
- Tanstack query for REST API data fetching with caching controls
- react router for client side routing
- CSS modules for styling provided by Vite out of the box
- Mantine UI for component library (not yet installed)
- Motion for react animation library
- ReChart for react charting library
- React hook form and Zod for react form library and validation
- Oxlint and oxfmt

### CSS modules
Create style file:
```
/* button.module.css */
.successButton {
  background-color: green;
  color: white;
}
```
Import and use it in the component:
```
// App.js
import styles from './button.module.css';

document.getElementById('app').innerHTML = `
  <button class="${styles.successButton}">Click Me</button>
`;
```