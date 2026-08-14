#!/bin/bash
# deploy.sh
docker stop my-blog 2>/dev/null
docker rm my-blog 2>/dev/null
docker run -d -p 8287:80 --name my-blog --restart always -v "$(pwd)":/usr/share/nginx/html:delegated nginx:alpine
echo "博客部署成功！访问 http://localhost:8287"