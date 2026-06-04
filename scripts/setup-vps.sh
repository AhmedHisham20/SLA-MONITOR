#!/bin/bash
set -e

echo "VPS Setup for Messenger SLA Monitor"
echo "===================================="

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone or copy project files
echo "Project files should be at /opt/messenger-sla-monitor/"
echo "Run: cd /opt/messenger-sla-monitor && bash scripts/deploy.sh"

# Setup systemd service for auto-start
sudo tee /etc/systemd/system/messenger-sla.service > /dev/null <<'EOF'
[Unit]
Description=Messenger SLA Monitor
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/messenger-sla-monitor
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable messenger-sla.service

# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo ""
echo "=================================="
echo "VPS setup complete!"
echo "Place project in /opt/messenger-sla-monitor/"
echo "Then run: cd /opt/messenger-sla-monitor && bash scripts/deploy.sh"
echo "=================================="
