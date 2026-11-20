<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";
  import { OP_ICON } from "../graph";
  import type { OpData } from "./data.svelte";
  import "../rich-operator.css";

  // Texera-like operator (?op=texera): same elements as the JointJS RichOperator.
  let { data }: NodeProps<Node<OpData, "op">> = $props();
</script>

<div class="op-rich" style:border-color={data.color}>
  <Handle type="target" position={Position.Left} />
  <span class="op-in-rows">{data.inRows}</span>
  <img class="op-icon" src={OP_ICON} alt="" />
  <span class="op-title">{data.name}</span>
  <span class="op-status">{data.status}</span>
  <span class="op-state" style:color={data.color}>{data.state}</span>
  <span class="op-workers" style:color={data.color}>{data.workers}</span>
  <span class="op-hidden op-editing"></span>
  <span class="op-hidden op-changed"></span>
  <img class="op-hidden op-view-result" src={OP_ICON} alt="" />
  <img class="op-hidden op-reuse-cache" src={OP_ICON} alt="" />
  <span class="op-boundary"></span>
  <svg class="op-hidden op-delete" viewBox="-9 -9 18 18">
    <circle r="8" fill="#fff" stroke="#D8656A" />
    <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="#D8656A" stroke-width="2" />
  </svg>
  <span class="op-out-rows">{data.outRows}</span>
  <Handle type="source" position={Position.Right} />
</div>
