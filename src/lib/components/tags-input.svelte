<script lang="ts">
	import { createTagsInput, melt } from '@melt-ui/svelte';
	import XIcon from '@lucide/svelte/icons/x';

	let {
		name,
		initial = [],
		placeholder = 'Add tag…'
	}: { name: string; initial?: string[]; placeholder?: string } = $props();

	const {
		elements: { root, input, tag, deleteTrigger, edit },
		states: { tags }
	} = createTagsInput({
		// intentionally only the initial value; svelte-check warns, eslint's svelte pass does not
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
		// svelte-ignore state_referenced_locally
		defaultTags: initial,
		unique: true,
		trim: true,
		addOnPaste: true,
		add: (value) => ({ id: value.toLowerCase(), value: value.toLowerCase() })
	});
</script>

<div
	use:melt={$root}
	class="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
>
	{#each $tags as t (t.id)}
		<div
			use:melt={$tag(t)}
			class="flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-secondary-foreground data-[selected]:bg-primary data-[selected]:text-primary-foreground"
		>
			<span>{t.value}</span>
			<button
				use:melt={$deleteTrigger(t)}
				type="button"
				class="rounded-xs opacity-60 hover:opacity-100"
				aria-label="Remove {t.value}"
			>
				<XIcon class="size-3" />
			</button>
		</div>
		<div
			use:melt={$edit(t)}
			class="rounded-sm px-1 outline-none data-[invalid-edit]:text-destructive"
		></div>
	{/each}
	<input
		use:melt={$input}
		type="text"
		{placeholder}
		class="min-w-24 flex-1 bg-transparent outline-none placeholder:text-muted-foreground data-[invalid]:text-destructive"
	/>
</div>
<input type="hidden" {name} value={$tags.map((t) => t.value).join(',')} />
