FROM --platform=${BUILDPLATFORM} node:18 AS build

WORKDIR /opt/node_app

COPY . .

# 设置npm淘宝镜像源加速依赖下载
RUN npm config set registry https://registry.npmmirror.com

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.npm \
    npm_config_target_arch=${TARGETARCH} npm install

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} npm run build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
