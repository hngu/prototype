#!/bin/sh
# Runs a 6-node local Redis Cluster (3 primaries + 3 replicas) in one container.
#
# Why one container instead of six: cluster nodes tell clients where to
# redirect (MOVED), so they must announce addresses the host can reach.
# Sharing one network namespace lets every node announce 127.0.0.1:<port>,
# which works for node-to-node gossip, for host clients via the port mappings,
# and for RedisInsight (network_mode: service:redis-cluster). Separate
# containers would have to announce either Docker IPs (unreachable from the
# host) or 127.0.0.1 (where each node would only find itself).
set -eu

PORTS="7001 7002 7003 7004 7005 7006"

start_node() {
  port=$1
  bus=$((port + 10000))
  redis-server \
    --port "$port" \
    --bind 0.0.0.0 \
    --protected-mode no \
    --cluster-enabled yes \
    --cluster-config-file "/data/nodes-${port}.conf" \
    --cluster-node-timeout 5000 \
    --cluster-announce-ip 127.0.0.1 \
    --cluster-announce-port "$port" \
    --cluster-announce-bus-port "$bus" \
    --appendonly yes \
    --appendfilename "appendonly-${port}.aof" \
    --dbfilename "dump-${port}.rdb" \
    --dir /data \
    --daemonize no &
}

# Check before starting nodes: redis-server creates nodes-*.conf on startup.
# Persisted node configs mean the cluster already exists. Creating it again
# fails with "Node is not empty" and takes the container down (set -e).
CLUSTER_EXISTS=no
if [ -f /data/nodes-7001.conf ]; then
  CLUSTER_EXISTS=yes
fi

for port in $PORTS; do
  start_node "$port"
done

for port in $PORTS; do
  until redis-cli -p "$port" ping 2>/dev/null | grep -q PONG; do
    sleep 0.2
  done
done

wait_for_cluster_ok() {
  until redis-cli -p 7001 cluster info 2>/dev/null | grep -q "cluster_state:ok"; do
    sleep 0.2
  done
}

if [ "$CLUSTER_EXISTS" = yes ]; then
  echo "cluster config found, waiting for cluster_state:ok"
  wait_for_cluster_ok
  echo "cluster already initialized"
else
  redis-cli --cluster create \
    127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 \
    127.0.0.1:7004 127.0.0.1:7005 127.0.0.1:7006 \
    --cluster-replicas 1 --cluster-yes
fi

trap 'kill $(jobs -p) 2>/dev/null' EXIT INT TERM
wait
