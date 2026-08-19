<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import XIcon from '@lucide/svelte/icons/x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let importForm = $state<HTMLFormElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let signOutForm = $state<HTMLFormElement | null>(null);

	let selectedFolder = $state<string | null>(null);
	let selectedTags = $state<string[]>([]);

	const allTags = $derived([...new Set(data.links.flatMap((l) => l.tags))].sort());
	const filteredLinks = $derived(
		data.links.filter(
			(l) =>
				(selectedFolder === null || l.folderId === selectedFolder) &&
				selectedTags.every((t) => l.tags.includes(t))
		)
	);
	const countInFolder = (folderId: string) =>
		data.links.filter((l) => l.folderId === folderId).length;
	const initials = $derived((data.user?.name ?? '?').slice(0, 2).toUpperCase());

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
	}

	$effect(() => {
		if (form?.action === 'import' && form.success) {
			toast.success(`Imported ${form.imported} links (${form.skipped} skipped)`);
		}
	});

	$effect(() => {
		// visits are logged out of band (short links open in another tab), so pull
		// fresh counts whenever this tab becomes active again
		const refresh = () => {
			if (!document.hidden) invalidateAll();
		};
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('focus', refresh);
		return () => {
			document.removeEventListener('visibilitychange', refresh);
			window.removeEventListener('focus', refresh);
		};
	});

	$effect(() => {
		// deselect a folder that no longer exists (e.g. after deletion)
		if (selectedFolder !== null && !data.folders.some((f) => f.id === selectedFolder)) {
			selectedFolder = null;
		}
	});
</script>

<svelte:head><title>zeiger</title></svelte:head>

<div class="mx-auto max-w-6xl p-4 sm:p-8">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-semibold tracking-tight">zeiger</h1>
		<div class="flex items-center gap-2">
			<Button href={resolve('/edit/[id]', { id: 'new' })}>
				<PlusIcon class="size-4" />
				New link
			</Button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class={buttonVariants({ variant: 'ghost', class: 'h-10 gap-2 px-2' })}
					aria-label="Account menu"
				>
					<Avatar.Root size="sm">
						<Avatar.Fallback class="text-xs">{initials}</Avatar.Fallback>
					</Avatar.Root>
					<span class="max-w-32 truncate text-sm">{data.user?.name}</span>
					<ChevronDownIcon class="size-4 text-muted-foreground" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {...props} href={resolve('/account')}>Account settings</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {...props} href={resolve('/api/export')}>Export JSON</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={() => fileInput?.click()}>Import JSON</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={() => signOutForm?.requestSubmit()}>
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</header>

	<form
		method="post"
		action="?/import"
		enctype="multipart/form-data"
		class="hidden"
		use:enhance
		bind:this={importForm}
	>
		<input
			type="file"
			name="file"
			accept="application/json,.json"
			bind:this={fileInput}
			onchange={() => importForm?.requestSubmit()}
		/>
	</form>
	<form method="post" action="?/signOut" class="hidden" use:enhance bind:this={signOutForm}></form>

	{#if form?.message}
		<p class="mt-4 text-sm text-destructive">{form.message}</p>
	{/if}

	<div class="mt-8 grid gap-8 sm:grid-cols-[14rem_1fr]">
		<aside class="flex flex-col gap-1">
			<button
				type="button"
				class="flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent {selectedFolder ===
				null
					? 'bg-accent font-medium'
					: ''}"
				onclick={() => (selectedFolder = null)}
			>
				All links
				<span class="ml-auto text-xs text-muted-foreground">{data.links.length}</span>
			</button>
			{#each data.folders as f (f.id)}
				<div class="group flex items-center">
					<button
						type="button"
						class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent {selectedFolder ===
						f.id
							? 'bg-accent font-medium'
							: ''}"
						onclick={() => (selectedFolder = f.id)}
					>
						<FolderIcon class="size-4 shrink-0 text-muted-foreground" />
						<span class="truncate">{f.name}</span>
						<span class="ml-auto text-xs text-muted-foreground">{countInFolder(f.id)}</span>
					</button>
					<form method="post" action="?/deleteFolder" use:enhance>
						<input type="hidden" name="id" value={f.id} />
						<button
							type="submit"
							class="rounded-md p-1 opacity-0 group-hover:opacity-60 hover:opacity-100!"
							title="Delete folder (links are kept)"
						>
							<XIcon class="size-3.5" />
						</button>
					</form>
				</div>
			{/each}
			<form method="post" action="?/createFolder" use:enhance class="mt-2 flex items-center gap-1">
				<Input name="name" placeholder="New folder" class="h-8 text-sm" required />
				<Button type="submit" variant="ghost" size="icon" class="size-8" aria-label="Create folder">
					<PlusIcon class="size-4" />
				</Button>
			</form>
		</aside>

		<main>
			{#if allTags.length > 0}
				<div class="mb-4 flex flex-wrap items-center gap-1.5">
					{#each allTags as tag (tag)}
						<button type="button" onclick={() => toggleTag(tag)}>
							<Badge variant={selectedTags.includes(tag) ? 'default' : 'secondary'}>
								{tag}
							</Badge>
						</button>
					{/each}
					{#if selectedTags.length > 0}
						<button
							type="button"
							class="text-xs text-muted-foreground hover:underline"
							onclick={() => (selectedTags = [])}
						>
							clear
						</button>
					{/if}
				</div>
			{/if}

			{#if filteredLinks.length === 0}
				<p class="py-24 text-center text-sm text-muted-foreground">
					{data.links.length === 0 ? 'No links yet — create your first one.' : 'No links match.'}
				</p>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{#each filteredLinks as l (l.id)}
						<Card.Root class="relative h-full gap-3 transition-colors hover:border-ring">
							<!-- the card opens the detail page; nested links/buttons sit above this overlay -->
							<a
								href={resolve('/edit/[id]', { id: l.id })}
								class="absolute inset-0 z-10 rounded-xl"
								aria-label="Edit {l.title}"
							></a>
							<Card.Header>
								<Card.Title class="flex items-center gap-2 text-base">
									{#if l.favicon}
										<img src={l.favicon} alt="" class="size-4 rounded-sm" loading="lazy" />
									{/if}
									<a
										href={resolve('/l/[short]', { short: l.short })}
										target="_blank"
										class="relative z-20 truncate hover:underline"
									>
										{l.title}
									</a>
								</Card.Title>
								<Card.Description class="truncate">
									<!-- eslint-disable svelte/no-navigation-without-resolve -- external destination URL -->
									<a
										href={l.url}
										target="_blank"
										rel="noreferrer"
										class="relative z-20 hover:underline"
									>
										{l.url}
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								</Card.Description>
							</Card.Header>
							<Card.Content class="flex flex-1 flex-col justify-end gap-3">
								{#if l.tags.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each l.tags as tag (tag)}
											<button type="button" class="relative z-20" onclick={() => toggleTag(tag)}>
												<Badge variant={selectedTags.includes(tag) ? 'default' : 'secondary'}>
													{tag}
												</Badge>
											</button>
										{/each}
									</div>
								{/if}
								<div class="flex items-center justify-end gap-2 text-sm">
									<span class="text-xs text-muted-foreground">
										{l.visits}
										{l.visits === 1 ? 'visit' : 'visits'}
									</span>
									<Badge variant={l.public ? 'default' : 'outline'}>
										{l.public ? 'public' : 'private'}
									</Badge>
								</div>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</main>
	</div>
</div>
