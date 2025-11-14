# CLAUDE.md

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

### Local Development (Port 3030)

```bash
# 方法1：使用 yarn start（会读取 .env.development 中的端口配置）
# 但由于环境变量优先级问题，推荐使用方法2
yarn start

# 方法2：直接指定端口启动（推荐）
cd excalidraw-app
yarn vite --port 3030

# 其他命令
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

**端口配置说明**:
- **本地开发**: 使用 3030 端口（`.env.development` 中配置为 3030）
- **生产部署**: 使用 3000 端口（`deploy-prod.sh` 中指定）
- 如果 `yarn start` 仍然启动在 3000，请使用 `cd excalidraw-app && yarn vite --port 3030`

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration