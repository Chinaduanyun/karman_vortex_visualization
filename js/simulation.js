/**
 * 卡门涡街可视化模拟
 * 使用粒子系统和简化的流体动力学模型实现
 */

document.addEventListener('DOMContentLoaded', () => {
    // 获取Canvas元素和上下文
    const canvas = document.getElementById('karmanCanvas');
    const ctx = canvas.getContext('2d');
    
    // 设置Canvas尺寸为其显示尺寸，并调整障碍物位置
    function resizeCanvas() {

        
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

    }
    
    // 初始调整Canvas尺寸
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 获取控制元素
    const velocitySlider = document.getElementById('velocity');
    const velocityValue = document.getElementById('velocity-value');
    const obstacleSizeSlider = document.getElementById('obstacle-size');
    const obstacleSizeValue = document.getElementById('obstacle-size-value');
    const viscositySlider = document.getElementById('viscosity');
    const viscosityValue = document.getElementById('viscosity-value');
    const resetButton = document.getElementById('reset');
    // 新增：显示涡旋点开关
    const showVorticesCheckbox = document.getElementById('show-vortices');
    let showVortices = showVorticesCheckbox ? showVorticesCheckbox.checked : true;
    if (showVorticesCheckbox) {
        showVorticesCheckbox.addEventListener('change', () => {
            showVortices = showVorticesCheckbox.checked;
        });
    }
    const particleCountSlider = document.getElementById('particle-count');
    const particleCountValue = document.getElementById('particle-count-value');

    // 模拟参数
    let params = {
        velocity: parseFloat(velocitySlider.value),
        obstacleSize: parseInt(obstacleSizeSlider.value),
        viscosity: parseFloat(viscositySlider.value),
        particleCount: parseInt(particleCountSlider.value),
        particleSize: 2,
        timeStep: 0.01,
        obstacleX: 0,
        obstacleY: 0
    };
    
    // 更新显示值
    function updateDisplayValues() {
        velocityValue.textContent = params.velocity;
        obstacleSizeValue.textContent = params.obstacleSize;
        viscosityValue.textContent = params.viscosity;
        particleCountValue.textContent = params.particleCount;
    }
    
    // 事件监听器
    velocitySlider.addEventListener('input', () => {
        params.velocity = parseFloat(velocitySlider.value);
        updateDisplayValues();
    });
    
    obstacleSizeSlider.addEventListener('input', () => {
        params.obstacleSize = parseInt(obstacleSizeSlider.value);
        updateDisplayValues();
    });
    
    viscositySlider.addEventListener('input', () => {
        params.viscosity = parseFloat(viscositySlider.value);
        updateDisplayValues();
    });
    
    particleCountSlider.addEventListener('input', () => {
        // 只更新目标数量，不重置粒子
        params.particleCount = parseInt(particleCountSlider.value);
        updateDisplayValues();
        // 不再调用initializeParticles()
    });

    resetButton.addEventListener('click', initializeParticles);
    
    // 涡旋点类
    class Vortex {
        constructor(x, y, strength, sign) {
            this.x = x;
            this.y = y;
            this.strength = strength; // 影响力
            this.sign = sign; // +1: 顺时针, -1: 逆时针
        }
        // 计算某点受此涡旋影响的速度分量
        velocityAt(px, py) {
            const dx = px - this.x;
            const dy = py - this.y;
            const r2 = dx * dx + dy * dy;
            if (r2 < 1) return {vx: 0, vy: 0};
            // Biot-Savart law (简化)
            const factor = this.strength * this.sign / (2 * Math.PI * r2);
            return {
                vx: -dy * factor,
                vy: dx * factor
            };
        }
    }

    let vortices = [];
    let vortexTimer = 0;
    let vortexSign = 1;

    // 粒子类
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = params.velocity;
            this.vy = 0;
            this.ax = 0;
            this.ay = 0;
            this.color = 'rgba(0, 120, 255, 0.7)';
            this.age = 0;
            this.maxAge = 1200 + Math.random() * 600; // 延长寿命
        }
        
        // 更新粒子位置和速度
        update() {
            // 障碍物排斥
            const dx = this.x - params.obstacleX;
            const dy = this.y - params.obstacleY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < params.obstacleSize * 1.1) {
                // 简单反弹
                const angle = Math.atan2(dy, dx);
                this.vx = Math.cos(angle) * params.velocity;
                this.vy = Math.sin(angle) * params.velocity;
            }
            // 受涡旋点影响
            let vx = params.velocity, vy = 0;
            for (let v of vortices) {
                const infl = v.velocityAt(this.x, this.y);
                vx += infl.vx;
                vy += infl.vy;
            }
            // 粘性阻力
            this.vx += (vx - this.vx) * 0.1;
            this.vy += (vy - this.vy) * 0.1;
            this.vx *= (1 - params.viscosity);
            this.vy *= (1 - params.viscosity);
            this.x += this.vx * params.timeStep * 10;
            this.y += this.vy * params.timeStep * 10;
            // 颜色随速度
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const speedRatio = Math.min(speed / (params.velocity * 2), 1);
            const hue = 200 + speedRatio * 160;
            this.color = `hsla(${hue}, 100%, 50%, 0.7)`;
            this.age++;
        }
        
        // 绘制粒子
        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, params.particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 判断粒子是否需要重置
        needsReset() {
            return this.x > canvas.width || 
                   this.x < 0 || 
                   this.y > canvas.height || 
                   this.y < 0 ||
                   this.age > this.maxAge;
        }
    }
    
    // 粒子系统
    let particles = [];
    let particleSpawnAccumulator = 0;
    let lastFrameTime = 0; // 用于计算帧间时间差

    // 初始化粒子系统
    function initializeParticles() {
        particles = [];
        vortices = [];
        vortexTimer = 0;
        vortexSign = 1;
        params.obstacleX = canvas.width / 3;
        params.obstacleY = canvas.height / 2;
        lastFrameTime = performance.now();
        particleSpawnAccumulator = 0;
    }

    // 每帧补充新粒子，采用恒定生成率与均匀分布
    function spawnParticles(deltaTime) {
        if (particles.length >= params.particleCount) return;
        
        // 根据当前粒子数与目标粒子数的差距确定生成速率
        const deficit = params.particleCount - particles.length;
        const baseRate = 2; // 基础生成速率（每帧）
        const adaptiveRate = Math.max(deficit / 100, 1); // 自适应生成速率
        const finalRate = Math.min(baseRate * adaptiveRate, 10); // 上限
        
        // 累计生成粒子数量（考虑时间差）
        particleSpawnAccumulator += finalRate * (deltaTime / 16.67); // 基于60fps标准化
        
        // 生成新粒子（均匀分布在入口处）
        while (particleSpawnAccumulator >= 1 && particles.length < params.particleCount) {
            // 计算生成位置 - 均匀分布在左侧入口
            const yPos = Math.random() * canvas.height;
            // 初始x位置在左侧2%区域，确保渐进入场
            const xPos = Math.random() * canvas.width * 0.02;
            
            particles.push(new Particle(xPos, yPos));
            particleSpawnAccumulator--;
        }
    }
    
    // 重置粒子，将其放回左侧
    function resetParticle(particle) {
        particle.x = Math.random() * canvas.width * 0.05; // 左侧5%区域
        particle.y = Math.random() * canvas.height;
        particle.vx = params.velocity;
        particle.vy = 0;
        particle.ax = 0;
        particle.ay = 0;
        particle.age = 0;
    }
    
    // canvas尺寸变化时自动重置粒子和涡旋点
    function resizeCanvasAndReset() {
        resizeCanvas();
        initializeParticles();
    }
    window.addEventListener('resize', resizeCanvasAndReset);

    // 动画循环
    function animate(currentTime) {
        // 计算帧间时间差（单位：毫秒）
        const deltaTime = lastFrameTime ? currentTime - lastFrameTime : 16.67;
        lastFrameTime = currentTime;
        
        // 限制极端帧率差异
        const clampedDelta = Math.min(deltaTime, 50);
        
        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制背景网格（辅助观察）
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
        ctx.lineWidth = 1;
        
        const gridSize = 20;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // 绘制障碍物
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(params.obstacleX, params.obstacleY, params.obstacleSize, 0, Math.PI * 2);
        ctx.fill();
        // 显示涡旋点
        if (showVortices) {
            for (let v of vortices) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(v.x, v.y, 7, 0, Math.PI * 2);
                ctx.strokeStyle = v.sign > 0 ? '#e74c3c' : '#2980b9';
                ctx.lineWidth = 2;
                ctx.globalAlpha = Math.max(Math.abs(v.strength) / 120, 0.2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = v.sign > 0 ? '#e74c3c' : '#2980b9';
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.restore();
            }
        }
        
        // 生成交替脱落的涡旋点（考虑帧率）
        vortexTimer += params.timeStep * params.velocity * 2 * (clampedDelta / 16.67);
        if (vortexTimer > 1.2) {
            const offsetY = params.obstacleSize * 0.9 * vortexSign;
            vortices.push(new Vortex(
                params.obstacleX + params.obstacleSize * 1.2,
                params.obstacleY + offsetY,
                120 * params.velocity,
                vortexSign
            ));
            vortexSign *= -1;
            vortexTimer = 0;
        }
        // 涡旋点随流体向右漂移并衰减
        for (let v of vortices) {
            v.x += params.velocity * params.timeStep * 8;
            v.strength *= 0.995;
        }
        // 移除无效涡旋点
        vortices = vortices.filter(v => v.x < canvas.width && Math.abs(v.strength) > 1);
        
        // 生成新粒子（传入时间差）
        spawnParticles(clampedDelta);
        // 更新和绘制所有粒子
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();

            particles[i].draw(ctx);
            if (particles[i].needsReset()) {
                // 移除消失的粒子，后续逐帧补充
                particles.splice(i, 1);
            }
        }
        
        // 绘制速度向量场（可选，仅在性能允许的情况下）
        if (params.particleCount < 600) {  // 只在粒子数较少时才显示向量场
            drawVelocityField();
        }
        
        requestAnimationFrame(animate);
    }
    
    // 绘制速度向量场（可视化流体流动）
    function drawVelocityField() {
        const step = 30;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        
        for (let x = step; x < canvas.width; x += step) {
            for (let y = step; y < canvas.height; y += step) {
                // 获取此点的速度
                const velocity = getVelocityAt(x, y);
                const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
                const angle = Math.atan2(velocity.y, velocity.x);
                
                // 仅在有明显速度时绘制
                if (speed > 0.1) {
                    const length = speed * 2;
                    
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                    ctx.stroke();
                }
            }
        }
    }
    
    // 获取某点处的速度场
    function getVelocityAt(x, y) {
        const dx = x - params.obstacleX;
        const dy = y - params.obstacleY;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        
        let vx = params.velocity;
        let vy = 0;
        
        if (dist < params.obstacleSize * 3) {
            const repulsion = params.velocity * (params.obstacleSize / dist) * 2;
            const tangentialForce = repulsion * 0.3;
            
            // 计算切向和法向分量
            const normalX = dx / dist;
            const normalY = dy / dist;
            const tangentialX = -dy / dist;
            const tangentialY = dx / dist;
            
            // 涡街效应
            const vortexStrength = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
            
            if (dist > params.obstacleSize) {
                vx += tangentialForce * tangentialX * (y > params.obstacleY ? 1 : -1) * vortexStrength;
                vx -= normalX * repulsion * (dist < params.obstacleSize * 1.5 ? 1 : 0);
                
                vy += tangentialForce * tangentialY * (y > params.obstacleY ? 1 : -1) * vortexStrength;
                vy -= normalY * repulsion * (dist < params.obstacleSize * 1.5 ? 1 : 0);
            }
        }
        
        return { x: vx, y: vy };
    }
    
     // 启动动画（传入时间戳）
     initializeParticles();

    updateDisplayValues();
    animate(performance.now());
});