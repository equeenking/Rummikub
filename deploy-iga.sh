#!/bin/bash

set -e

echo "======================================"
echo "  Rummikub 部署脚本 - 火山方舟 IGA Pages"
echo "======================================"

echo "1. 检查 npm 环境..."
if ! command -v npm &> /dev/null; then
    echo "请先安装 Node.js 和 npm"
    exit 1
fi

echo "2. 安装项目依赖..."
npm install

echo "3. 安装 IGA CLI..."
npm install -g @iga-pages/cli

echo "4. 构建项目..."
npm run build

echo "5. 登录火山方舟..."
iga login

echo "6. 部署到 IGA Pages..."
iga deploy

echo "======================================"
echo "  部署完成！"
echo "======================================"
echo ""
echo "项目地址: https://rummikub-game-dzkgg9ayrl.iga-pages.com"
echo "查看部署日志: iga logs"
echo "重新部署: iga deploy"