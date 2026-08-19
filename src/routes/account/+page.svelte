<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Card from '$lib/components/ui/card';
	import { formatDate } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	$effect(() => {
		if (form?.success) {
			toast.success(
				form.revokedOtherSessions
					? 'Password changed — other devices were signed out'
					: 'Password changed'
			);
		}
	});
</script>

<svelte:head><title>Account · zeiger</title></svelte:head>

<div class="mx-auto max-w-3xl p-4 sm:p-8">
	<div class="mb-6 flex items-center justify-between">
		<Button variant="ghost" href={resolve('/')}>← Back</Button>
		<form method="post" action="?/signOut" use:enhance>
			<Button variant="outline" type="submit">Sign out</Button>
		</form>
	</div>

	<div class="grid gap-6">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Account</Card.Title>
				<Card.Description
					>Member since {formatDate(data.account.createdAt, data.locale)}</Card.Description
				>
			</Card.Header>
			<Card.Content>
				<dl class="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
					<dt class="text-muted-foreground">Username</dt>
					<dd class="font-mono">{data.account.username}</dd>
					<dt class="text-muted-foreground">Display name</dt>
					<dd>{data.account.name}</dd>
				</dl>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Change password</Card.Title>
				<Card.Description>Confirm your current password to choose a new one.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="post" action="?/changePassword" use:enhance class="grid max-w-sm gap-4">
					<!-- the username is inert here, but password managers need it to know
					     which credential the new password belongs to -->
					<input
						type="text"
						name="username"
						value={data.account.username}
						autocomplete="username"
						hidden
						readonly
					/>
					<div class="grid gap-2">
						<Label for="currentPassword">Current password</Label>
						<Input
							id="currentPassword"
							name="currentPassword"
							type="password"
							autocomplete="current-password"
							required
						/>
					</div>
					<div class="grid gap-2">
						<Label for="newPassword">New password</Label>
						<Input
							id="newPassword"
							name="newPassword"
							type="password"
							autocomplete="new-password"
							minlength={8}
							required
						/>
					</div>
					<div class="grid gap-2">
						<Label for="confirmPassword">Confirm new password</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							autocomplete="new-password"
							minlength={8}
							required
						/>
					</div>
					<div class="flex items-center gap-2">
						<Switch id="revokeOtherSessions" name="revokeOtherSessions" />
						<Label for="revokeOtherSessions">Sign out other devices</Label>
					</div>
					{#if form?.message}
						<p class="text-sm text-destructive">{form.message}</p>
					{/if}
					<div class="flex justify-end">
						<Button type="submit">Update password</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
