import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon, ChevronDown, XCircle, XIcon } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '@/components/ui/command';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Variants for the multi-select component badges
 */
const multiSelectVariants = cva('m-1 transition-all duration-200', {
	variants: {
		variant: {
			default: 'border-foreground/10 text-foreground bg-card hover:bg-card/80',
			secondary:
				'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
			destructive:
				'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
			inverted: 'inverted',
		},
	},
	defaultVariants: {
		variant: 'default',
	},
});

/**
 * Option interface for MultiSelect component
 */
export interface MultiSelectOption {
	/** The text to display for the option */
	label: string;
	/** The unique value associated with the option */
	value: string;
	/** Optional icon component */
	icon?: React.ComponentType<{ className?: string }>;
	/** Whether this option is disabled */
	disabled?: boolean;
}

/**
 * Props for MultiSelect component
 */
interface MultiSelectProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof multiSelectVariants> {
	/** Array of options to display */
	options: MultiSelectOption[];
	/** Callback when selection changes */
	onValueChange: (value: string[]) => void;
	/** Currently selected values */
	defaultValue?: string[];
	/** Placeholder text */
	placeholder?: string;
	/** Maximum badges to show before collapsing */
	maxCount?: number;
	/** Whether the popover should be modal */
	modalPopover?: boolean;
	/** Custom class for the component */
	className?: string;
	/** Whether to show the search input */
	searchable?: boolean;
	/** Custom empty state message */
	emptyMessage?: string;
	/** Whether the component is disabled */
	disabled?: boolean;
	/** Whether to show select all option */
	showSelectAll?: boolean;
}

export const MultiSelect = React.forwardRef<
	HTMLButtonElement,
	MultiSelectProps
>(
	(
		{
			options,
			onValueChange,
			variant,
			defaultValue = [],
			placeholder = 'Select options',
			maxCount = 3,
			modalPopover = false,
			className,
			searchable = true,
			emptyMessage = 'No options found.',
			disabled = false,
			showSelectAll = false,
			...props
		},
		ref,
	) => {
		const [selectedValues, setSelectedValues] =
			React.useState<string[]>(defaultValue);
		const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
		const [searchValue, setSearchValue] = React.useState('');

		// Sync with external defaultValue changes
		React.useEffect(() => {
			setSelectedValues(defaultValue);
		}, [defaultValue]);

		const handleInputKeyDown = (
			event: React.KeyboardEvent<HTMLInputElement>,
		) => {
			if (event.key === 'Enter') {
				setIsPopoverOpen(true);
			} else if (event.key === 'Backspace' && !event.currentTarget.value) {
				const newSelectedValues = [...selectedValues];
				newSelectedValues.pop();
				setSelectedValues(newSelectedValues);
				onValueChange(newSelectedValues);
			}
		};

		const toggleOption = (value: string) => {
			const newSelectedValues = selectedValues.includes(value)
				? selectedValues.filter((v) => v !== value)
				: [...selectedValues, value];
			setSelectedValues(newSelectedValues);
			onValueChange(newSelectedValues);
		};

		const handleClear = () => {
			setSelectedValues([]);
			onValueChange([]);
		};

		const handleTogglePopover = () => {
			if (!disabled) {
				setIsPopoverOpen((prev) => !prev);
			}
		};

		const handleSelectAll = () => {
			const allValues = options
				.filter((option) => !option.disabled)
				.map((option) => option.value);
			setSelectedValues(allValues);
			onValueChange(allValues);
		};

		const getOptionByValue = (value: string) => {
			return options.find((option) => option.value === value);
		};

		const filteredOptions = React.useMemo(() => {
			if (!searchValue) return options;
			return options.filter((option) =>
				option.label.toLowerCase().includes(searchValue.toLowerCase()),
			);
		}, [options, searchValue]);

		const clearExtraOptions = () => {
			const newSelectedValues = selectedValues.slice(0, maxCount);
			setSelectedValues(newSelectedValues);
			onValueChange(newSelectedValues);
		};

		return (
			<Popover
				open={isPopoverOpen}
				onOpenChange={setIsPopoverOpen}
				modal={modalPopover}
			>
				<PopoverTrigger asChild>
					<Button
						ref={ref}
						{...props}
						onClick={handleTogglePopover}
						disabled={disabled}
						variant="outline"
						role="combobox"
						aria-expanded={isPopoverOpen}
						className={cn(
							'flex min-h-10 w-full items-center justify-between rounded-md border bg-inherit p-1 hover:bg-inherit [&_svg]:pointer-events-auto',
							disabled && 'cursor-not-allowed opacity-50',
							className,
						)}
					>
						{selectedValues.length > 0 ? (
							<div className="flex w-full items-center justify-between">
								<div className="flex flex-wrap items-center gap-1">
									{selectedValues.slice(0, maxCount).map((value) => {
										const option = getOptionByValue(value);
										const IconComponent = option?.icon;
										return (
											<Badge
												key={value}
												className={cn(multiSelectVariants({ variant }))}
											>
												{IconComponent && (
													<IconComponent className="mr-1 size-3" />
												)}
												<span className="max-w-[100px] truncate">
													{option?.label}
												</span>
												<XCircle
													className="ml-1 size-3 cursor-pointer hover:text-foreground"
													onClick={(event) => {
														event.stopPropagation();
														toggleOption(value);
													}}
												/>
											</Badge>
										);
									})}
									{selectedValues.length > maxCount && (
										<Badge
											className={cn(
												'border-foreground/1 bg-transparent text-foreground hover:bg-transparent',
												multiSelectVariants({ variant }),
											)}
										>
											{`+ ${selectedValues.length - maxCount} more`}
											<XCircle
												className="ml-1 size-3 cursor-pointer hover:text-foreground"
												onClick={(event) => {
													event.stopPropagation();
													clearExtraOptions();
												}}
											/>
										</Badge>
									)}
								</div>
								<div className="flex items-center justify-between gap-1">
									<XIcon
										className="mx-1 size-4 cursor-pointer text-muted-foreground hover:text-foreground"
										onClick={(event) => {
											event.stopPropagation();
											handleClear();
										}}
									/>
									<Separator
										orientation="vertical"
										className="flex h-full min-h-5"
									/>
									<ChevronDown className="mx-1 size-4 cursor-pointer text-muted-foreground" />
								</div>
							</div>
						) : (
							<div className="mx-auto flex w-full items-center justify-between">
								<span className="mx-2 text-sm text-muted-foreground">
									{placeholder}
								</span>
								<ChevronDown className="mx-2 size-4 cursor-pointer text-muted-foreground" />
							</div>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-[var(--radix-popover-trigger-width)] p-0"
					align="start"
					onEscapeKeyDown={() => setIsPopoverOpen(false)}
				>
					<Command>
						{searchable && (
							<CommandInput
								placeholder="Search..."
								onKeyDown={handleInputKeyDown}
								value={searchValue}
								onValueChange={setSearchValue}
							/>
						)}
						<CommandList>
							<CommandEmpty>{emptyMessage}</CommandEmpty>
							{showSelectAll && filteredOptions.length > 0 && (
								<CommandGroup>
									<CommandItem
										onSelect={handleSelectAll}
										className="cursor-pointer"
									>
										<div
											className={cn(
												'mr-2 flex size-4 items-center justify-center rounded-sm border border-primary',
												selectedValues.length === options.length
													? 'bg-primary text-primary-foreground'
													: 'opacity-50 [&_svg]:invisible',
											)}
										>
											<CheckIcon className="size-4" />
										</div>
										<span>(Select All)</span>
									</CommandItem>
								</CommandGroup>
							)}
							<CommandGroup>
								{filteredOptions.map((option) => {
									const isSelected = selectedValues.includes(option.value);
									return (
										<CommandItem
											key={option.value}
											onSelect={() => toggleOption(option.value)}
											className={cn(
												'cursor-pointer',
												option.disabled && 'cursor-not-allowed opacity-50',
											)}
											disabled={option.disabled}
										>
											<div
												className={cn(
													'mr-2 flex size-4 items-center justify-center rounded-sm border border-primary',
													isSelected
														? 'bg-primary text-primary-foreground'
														: 'opacity-50 [&_svg]:invisible',
												)}
											>
												<CheckIcon className="size-4" />
											</div>
											{option.icon && (
												<option.icon className="mr-2 size-4 text-muted-foreground" />
											)}
											<span>{option.label}</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
							{selectedValues.length > 0 && (
								<>
									<CommandSeparator />
									<CommandGroup>
										<div className="flex items-center justify-between">
											<CommandItem
												onSelect={handleClear}
												className="flex-1 cursor-pointer justify-center"
											>
												Clear
											</CommandItem>
											<Separator
												orientation="vertical"
												className="flex h-full min-h-5"
											/>
											<CommandItem
												onSelect={() => setIsPopoverOpen(false)}
												className="flex-1 cursor-pointer justify-center"
											>
												Close
											</CommandItem>
										</div>
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		);
	},
);

MultiSelect.displayName = 'MultiSelect';
