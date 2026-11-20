<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";
  import { NODE_H, NODE_W } from "../graph";

  // Same operator as the React Flow and JointJS ones: box, name, status line, two ports.
  let { data }: NodeProps<Node<{ name: string; status: string }, "op">> = $props();
</script>

<div
  style="width:{NODE_W}px;height:{NODE_H}px;background:#fff;border:1px solid #bfbfbf;border-radius:6px;font-family:sans-serif;text-align:center;box-sizing:border-box;padding-top:10px">
  <Handle type="target" position={Position.Left} />
  <div style="font-size:13px;color:#262626">{data.name}</div>
  <div class="op-status" style="font-size:11px;color:#8c8c8c;margin-top:6px">{data.status}</div>
  <Handle type="source" position={Position.Right} />
</div>
