#!/bin/bash

set -e

APP_NAME="rummikub"
APP_DIR="/opt/rummikub"
NODE_VERSION="20.x"

echo "======================================"
echo "  Rummikub 部署脚本 - 火山引擎 ECS"
echo "======================================"

echo "1. 检查并安装 Node.js..."
if ! command -v node &> /dev/null; then
    echo "正在安装 Node.js $NODE_VERSION..."
    curl -fsSL https://rpm.nodesource.com/setup_$NODE_VERSION | bash -
    yum install -y nodejs
else
    echo "Node.js 已安装: $(node --version)"
fi

echo "2. 检查并安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "正在安装 PM2..."
    npm install -g pm2
else
    echo "PM2 已安装: $(pm2 --version)"
fi

echo "3. 创建应用目录..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs

echo "4. 复制项目文件..."
cp -r ./* $APP_DIR/

echo "5. 安装依赖..."
cd $APP_DIR
npm install --production

echo "6. 启动应用..."
pm2 start ecosystem.config.js --env production

echo "7. 设置开机自启..."
pm2 startup
pm2 save

echo "======================================"
echo "  部署完成！"
echo "======================================"
echo ""
echo "应用地址: http://localhost:3000"
echo "PM2 状态: pm2 status"
echo "查看日志: pm2 logs $APP_NAME"
echo "重启应用: pm2 restart $APP_NAME"