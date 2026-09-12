# Firefox Source Code Review

Avy Tab Switcher is written in TypeScript and Vue and built with WXT. WXT uses Vite and Rollup to compile Vue single-file components, transpile TypeScript, bundle modules, and minify the submitted extension.

## Build environment

The release build runs on Linux (`ubuntu-latest` on GitHub Actions) and requires:

- Node.js 22
- pnpm 10.33.2
- Internet access to download the dependencies recorded in `pnpm-lock.yaml`

The build does not require environment variables, credentials, browser binaries, or proprietary tools.

Install [Node.js 22](https://nodejs.org/en/download), then install the required pnpm version:

```sh
npm install --global pnpm@10.33.2
```

## Build the Firefox package

From the root of the extracted source archive, run:

```sh
pnpm install --frozen-lockfile
pnpm run package:firefox
```

The first command also runs `wxt prepare` through the package's `postinstall` script. The resulting add-on is:

```text
.output/avy-tab-switcher-0.1.2-firefox.zip
```

## Validator warning

The validator's `innerHTML` warning refers to Vue 3's `@vue/runtime-dom` implementation for inserting build-time compiled static templates. This extension does not use `v-html`, runtime templates, or application-level `innerHTML` assignments. Dynamic tab data is rendered through escaped Vue text bindings.

Source repository: <https://github.com/Artawower/avy-tab-swithcer>
