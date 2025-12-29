import { useNavigate } from '@tanstack/react-router';
import type { User } from 'better-auth/types';
import { KeyRound, Loader2, LogOut, Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { invalidateSessionCache } from '@/lib/auth-check';
import {
	authClient,
	changeEmail,
	signOut,
	updateUser,
	useSession,
} from '@/lib/auth-client';

export function UserCard() {
	const { data: session, isPending } = useSession();
	const navigate = useNavigate();

	const handleSignOut = async () => {
		await signOut();
		invalidateSessionCache();
		navigate({
			to: '/auth/login',
			search: { redirect: undefined, error: undefined },
		});
	};

	if (isPending) {
		return (
			<Card className="w-full">
				<CardContent className="flex items-center justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin" />
				</CardContent>
			</Card>
		);
	}

	if (!session?.user) {
		return (
			<Card className="w-full">
				<CardContent className="py-8 text-center">
					<p className="text-muted-foreground">Not signed in</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>User</CardTitle>
			</CardHeader>
			<CardContent className="grid grid-cols-1 gap-8">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-4">
						<div className="grid gap-1">
							<p className="text-sm leading-none font-medium">
								{session.user.name}
							</p>
							<p className="text-sm">{session.user.email}</p>
							<p className="text-sm">User ID: {session.user.id}</p>
						</div>
					</div>
					<div className="flex gap-2">
						<ChangeEmailDialog currentEmail={session.user.email} />
						<EditUserDialog user={session.user} />
					</div>
				</div>
				<div className="flex items-center justify-between">
					<Button variant="outline" className="gap-2" onClick={handleSignOut}>
						<LogOut />
						Sign Out
					</Button>
					<div>
						<TwoFactorDialog
							enabled={session.user.twoFactorEnabled ?? undefined}
						/>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2 border-y py-4">
					<div className="flex flex-col gap-2">
						<p className="text-sm">Passkeys</p>
						<div className="flex flex-wrap gap-2">
							<AddPasskeyDialog />
							<ListPasskeys />
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function EditUserDialog(props: { user?: User }) {
	const { user } = props;
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState<string | undefined>();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger>
				<Button variant="secondary">Edit User</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit User</DialogTitle>
					<DialogDescription>Edit User Information</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="full-name">Full Name</Label>
					<Input
						placeholder={user?.name}
						type="text"
						value={name || ''}
						onInput={(e) => {
							if ('value' in e.target) setName(e.target.value as string);
						}}
					/>
				</div>
				<DialogFooter>
					<Button
						onClick={async () => {
							setIsLoading(true);
							await updateUser({
								name: name,
								fetchOptions: {
									onResponse() {
										setIsLoading(false);
									},
									onError(context) {
										alert(context.error.message);
									},
									onSuccess() {
										alert('User Updated Successfully');
										setIsOpen(false);
									},
								},
							});
						}}
					>
						{isLoading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<p>Update</p>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ChangeEmailDialog(props: { currentEmail: string }) {
	const [isOpen, setIsOpen] = useState(false);
	const [newEmail, setNewEmail] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Mail className="h-4 w-4 mr-2" />
					Change Email
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change Email Address</DialogTitle>
					<DialogDescription>
						Enter your new email address. A verification email will be sent to
						confirm the change.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="current-email">Current Email</Label>
						<Input
							id="current-email"
							type="email"
							value={props.currentEmail}
							disabled
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="new-email">New Email</Label>
						<Input
							id="new-email"
							type="email"
							placeholder="new-email@example.com"
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setIsOpen(false)}>
						Cancel
					</Button>
					<Button
						onClick={async () => {
							if (!newEmail) {
								toast.error('Please enter a new email address');
								return;
							}
							if (newEmail === props.currentEmail) {
								toast.error('New email must be different from current email');
								return;
							}
							setIsLoading(true);
							const { error } = await changeEmail({
								newEmail,
								callbackURL: '/dashboard',
							});
							setIsLoading(false);
							if (error) {
								toast.error(error.message || 'Failed to change email');
							} else {
								toast.success(
									'Verification email sent! Please check your inbox.',
								);
								setNewEmail('');
								setIsOpen(false);
							}
						}}
						disabled={isLoading}
					>
						{isLoading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							'Send Verification'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AddPasskeyDialog() {
	const [name, setName] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	return (
		<Dialog>
			<DialogTrigger>
				<Button variant="outline">Add Passkey</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Register New Passkey</DialogTitle>
					<DialogDescription>
						Add a new passkey to your account
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="passkey-name">Passkey Name (optional)</Label>
					<Input
						type="text"
						placeholder="My Passkey"
						value={name}
						onInput={(e) => {
							if ('value' in e.target) setName(e.target.value as string);
						}}
					/>
				</div>
				<DialogFooter>
					<Button
						onClick={async () => {
							setIsLoading(true);
							const { error } = await authClient.passkey.addPasskey({
								name: name || undefined,
							});
							setIsLoading(false);
							if (error) {
								toast.error(error.message || 'Failed to add passkey');
							} else {
								toast.success('Passkey added successfully');
								setName('');
							}
						}}
					>
						{isLoading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<div className="flex items-center gap-2">
								<KeyRound />
								Add Passkey
							</div>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ListPasskeys() {
	const [passkeysData, setPasskeysData] = useState<
		{ id: string; name?: string }[] | null
	>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const fetchPasskeys = async () => {
		setIsLoading(true);
		const { data, error } = await authClient.passkey.listUserPasskeys();
		setIsLoading(false);
		if (error) {
			toast.error('Failed to load passkeys');
		} else {
			setPasskeysData(data);
		}
	};

	const handleDelete = async (id: string) => {
		setDeletingId(id);
		const { error } = await authClient.passkey.deletePasskey({ id });
		setDeletingId(null);
		if (error) {
			toast.error(error.message || 'Failed to delete passkey');
		} else {
			toast.success('Passkey deleted successfully');
			fetchPasskeys();
		}
	};

	return (
		<Dialog onOpenChange={(open) => open && fetchPasskeys()}>
			<DialogTrigger>
				<Button variant="outline">
					Passkeys {passkeysData?.length ? `[${passkeysData?.length}]` : ''}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Passkeys</DialogTitle>
					<DialogDescription>List of passkeys</DialogDescription>
				</DialogHeader>
				{isLoading ? (
					<div className="flex items-center justify-center py-4">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : passkeysData?.length ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{passkeysData?.map((passkey) => (
								<TableRow
									key={passkey.id}
									className="flex items-center justify-between"
								>
									<TableCell>{passkey.name || 'My Passkey'}</TableCell>
									<TableCell className="text-right">
										<Button
											variant="destructive"
											onClick={() => handleDelete(passkey.id)}
										>
											{deletingId === passkey.id ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Trash2 />
											)}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<p className="text-muted-foreground text-sm">No passkeys found</p>
				)}
			</DialogContent>
		</Dialog>
	);
}

function TwoFactorDialog(props: { enabled?: boolean }) {
	const [isOpen, setIsOpen] = useState(false);
	const [password, setPassword] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(false);

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger>
				<Button variant="secondary">
					{props.enabled ? 'Disable 2FA' : 'Enable 2FA'}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Enable Two Factor</DialogTitle>
					<DialogDescription>
						Enable two factor authentication
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="password">Password</Label>
					<Input
						type="password"
						placeholder="Password"
						value={password || ''}
						onInput={(e) => {
							if ('value' in e.target) setPassword(e.target.value as string);
						}}
					/>
				</div>
				<DialogFooter>
					<Button
						onClick={async () => {
							if (!password) {
								alert('Password is required!');
								return;
							}
							setIsLoading(true);
							if (props.enabled) {
								const { error } = await authClient.twoFactor.disable({
									password: password,
								});
								setIsLoading(false);
								if (error) {
									alert(error.message);
								} else {
									toast.success('Two factor is disabled!');
									setIsOpen(false);
								}
								return;
							}
							const { error } = await authClient.twoFactor.enable({
								password: password,
							});
							setIsLoading(false);
							if (error) {
								alert(error.message);
							} else {
								toast.success('Two factor successfully enabled!');
								setIsOpen(false);
							}
						}}
					>
						{isLoading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<p>{props.enabled ? 'Disable' : 'Enable'}</p>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
