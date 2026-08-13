
        const form = document.getElementById('adminLoginForm');
        form.addEventListener('submit', event => {
            event.preventDefault();
            const user = document.getElementById('adminUser').value.trim();
            const pass = document.getElementById('adminPass').value;
            if (user === 'admin' && pass === 'admin123') {
                localStorage.setItem('isAdmin', 'true');
                alert('登录成功，已进入管理员模式');
                window.location.href = '../index.html';
            } else {
                alert('账号或密码错误');
            }
        });
    