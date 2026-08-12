<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Debounced } from 'runed';
	import QRCode from 'qrcode';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import TagsInput from '$lib/components/tags-input.svelte';
	import { formatDate, formatDateTime } from '$lib/format';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// enhance resets the form on a successful action by default, which would wipe
	// the fields the user just saved — keep their input and only refresh the data
	const saveEnhance: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	// the fields are bound to state rather than rendered from `data` directly, so
	// neither browser form restoration on reload nor a reused component instance
	// (navigating from one link to another) can leave stale values behind
	// svelte-ignore state_referenced_locally
	let loadedId = $state(data.link?.id ?? 'new');
	// svelte-ignore state_referenced_locally
	let title = $state(data.link?.title ?? '');
	// svelte-ignore state_referenced_locally
	let url = $state(data.link?.url ?? '');
	// svelte-ignore state_referenced_locally
	let short = $state(data.link?.short ?? '');
	// svelte-ignore state_referenced_locally
	let isPublic = $state(data.link?.public ?? false);
	// svelte-ignore state_referenced_locally
	let folderId = $state(data.link?.folderId ?? '');

	$effect(() => {
		const id = data.link?.id ?? 'new';
		if (id === loadedId) return; // saving re-runs load for the same link: keep what is typed
		loadedId = id;
		title = data.link?.title ?? '';
		url = data.link?.url ?? '';
		short = data.link?.short ?? '';
		isPublic = data.link?.public ?? false;
		folderId = data.link?.folderId ?? '';
	});

	const debouncedShort = new Debounced(() => short.trim().toLowerCase(), 400);

	// svelte-ignore state_referenced_locally
	let qr = $state<string | null>(data.qr);
	$effect(() => {
		const value = debouncedShort.current;
		if (!value) {
			qr = null;
			return;
		}
		// a saved link already has a server-rendered QR code, so show that immediately
		// instead of waiting for the debounce to settle after load
		if (data.qr && value === data.link?.short) {
			qr = data.qr;
			return;
		}
		let stale = false;
		QRCode.toDataURL(`${page.url.origin}/l/${value}`, { width: 256, margin: 1 }).then((dataUrl) => {
			if (!stale) qr = dataUrl;
		});
		return () => (stale = true);
	});

	const folderName = $derived(data.folders.find((f) => f.id === folderId)?.name ?? 'No folder');
</script>

<svelte:head><title>{data.link?.title ?? 'New link'} · zeiger</title></svelte:head>

<div class="mx-auto max-w-3xl p-4 sm:p-8">
	<div class="mb-6 flex items-center justify-between">
		<Button variant="ghost" href={resolve('/')}>← Back</Button>
		{#if data.link}
			<AlertDialog.Root>
				<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
					Delete link
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete “{data.link.title}”?</AlertDialog.Title>
						<AlertDialog.Description>
							The short link /l/{data.link.short} will stop working. This cannot be undone.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<form method="post" action="?/delete" use:enhance>
							<Button variant="destructive" type="submit" class="w-full">Delete</Button>
						</form>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}
	</div>

	<div class="grid gap-6 sm:grid-cols-[16rem_1fr]">
		<Card.Root class="h-fit">
			<Card.Header>
				<Card.Title class="text-base">QR code</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col items-center gap-3">
				{#if qr}
					<img src={qr} alt="QR code for /l/{debouncedShort.current}" class="rounded-md border" />
				{:else}
					<p class="py-8 text-center text-sm text-muted-foreground">
						The QR code appears once the link has a name.
					</p>
				{/if}
				{#if data.link}
					<Badge variant={isPublic ? 'default' : 'outline'}>
						{isPublic ? 'public' : 'private'}
					</Badge>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base">
					{#if data.link?.favicon}
						<img src={data.link.favicon} alt="" class="size-4 rounded-sm" />
					{/if}
					{data.link ? 'Edit link' : 'New link'}
				</Card.Title>
				{#if data.link}
					<Card.Description>
						Created {formatDate(data.link.createdAt, data.locale)}
					</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content>
				<form
					method="post"
					action="?/save"
					use:enhance={saveEnhance}
					autocomplete="off"
					class="grid gap-4"
				>
					<div class="grid gap-2">
						<Label for="title">Title</Label>
						<Input id="title" name="title" bind:value={title} placeholder="Svelte docs" required />
					</div>
					<div class="grid gap-2">
						<Label for="url">Destination</Label>
						<Input
							id="url"
							name="url"
							bind:value={url}
							placeholder="https://svelte.dev/docs"
							required
						/>
					</div>
					<div class="grid gap-2">
						<Label for="short">Name</Label>
						<div
							class="flex items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
						>
							<span class="border-r px-3 py-1 font-mono text-sm text-muted-foreground">/l/</span>
							<input
								id="short"
								name="short"
								bind:value={short}
								placeholder="auto-generated"
								pattern={'[a-zA-Z0-9_-]{1,64}'}
								class="min-w-0 flex-1 bg-transparent px-3 py-1 font-mono text-sm outline-none placeholder:text-muted-foreground"
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							Letters, digits, - and _. Leave empty to auto-generate.
						</p>
					</div>
					<div class="grid gap-2">
						<Label>Folder</Label>
						<Select.Root type="single" name="folder" bind:value={folderId}>
							<Select.Trigger class="w-full">{folderName}</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No folder</Select.Item>
								{#each data.folders as f (f.id)}
									<Select.Item value={f.id}>{f.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="grid gap-2">
						<Label>Tags</Label>
						{#key loadedId}
							<TagsInput name="tags" initial={data.link?.tags ?? []} />
						{/key}
					</div>
					<div class="flex items-center gap-2">
						<Switch id="public" name="public" bind:checked={isPublic} />
						<Label for="public">Publicly accessible</Label>
					</div>
					{#if form?.message}
						<p class="text-sm text-destructive">{form.message}</p>
					{/if}
					{#if form?.success}
						<p class="text-sm text-muted-foreground">Saved.</p>
					{/if}
					<div class="flex justify-end">
						<Button type="submit">{data.link ? 'Save changes' : 'Create link'}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>

	{#if data.link}
		<Card.Root class="mt-6">
			<Card.Header>
				<Card.Title class="text-base">Visits</Card.Title>
				<Card.Description>
					{data.visitCount}
					{data.visitCount === 1 ? 'visit' : 'visits'} total
				</Card.Description>
			</Card.Header>
			{#if data.recentVisits.length > 0}
				<Card.Content>
					<ul class="grid gap-2 text-sm">
						{#each data.recentVisits as visit (visit.visitedAt)}
							<li class="flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0">
								<span>{formatDateTime(visit.visitedAt, data.locale)}</span>
								<span class="min-w-0 truncate text-right text-muted-foreground">
									{visit.username ?? 'anonymous'}
									{#if visit.referer}
										· from {visit.referer}
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</Card.Content>
			{/if}
		</Card.Root>
	{/if}
</div>
