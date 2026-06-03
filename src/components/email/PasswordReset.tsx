import type * as React from 'react';
import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
} from 'react-email';

interface PasswordResetProps {
	url: string;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({ url }) => {
	return (
		<Html>
			<Head />
			<Preview>Reset Your Password</Preview>
			<Tailwind>
				<Body className="mx-auto my-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-stone-300 bg-stone-100 p-[20px]">
						<Section className="my-[20px] px-[32px] py-[20px]">
							<Row>
								<Column align="center">
									<Link href="https://www.airwartrail.com/">
										<Img
											alt="Air War Trail Logo"
											height="150"
											src="https://assets.airwartrail.com/static/Airwar-Trail-Logo.png"
										/>
									</Link>
									<Heading as="h1" className="text-4xl">
										Air War Trail
									</Heading>
								</Column>
							</Row>
						</Section>
						<Section className="mb-[24px]">
							<Row>
								<Column className="text-center">
									<Text className="text-center text-xl font-bold text-stone-900">
										Reset Your Password
									</Text>
									<Text className="text-base text-stone-700">
										Click the link below to set a new password. If you did not
										request a password reset, please ignore this email.
									</Text>
									<Button
										className="box-border w-full max-w-[200px] rounded-[8px] bg-green-800 p-3 font-semibold text-white"
										href={url}
									>
										Reset Password
									</Button>
									<Text className="text-base text-stone-700">
										Link will expire in one hour.
									</Text>
								</Column>
							</Row>
						</Section>
						<Section className="my-[24px] py-[24px] text-center">
							<Row className="mt-[24px]">
								<Column className="text-center">
									<Img
										alt="Air War Trail Logo"
										width="80"
										src="https://assets.airwartrail.com/static/Airwar-Trail-Logo.png"
										className="mx-auto w-[80px]"
									/>
								</Column>
							</Row>
							<Row className="my-[12px]">
								<Column className="text-center">
									<Link href="http://www.youtube.com/@airwartrail">
										<Img
											alt="YouTube logo"
											height="64"
											src="https://assets.airwartrail.com/static/YouTube-Logo-Dark.png"
											width="64"
											className="mx-auto"
										/>
										<span className="text-[12px]">Check us out on YouTube</span>
									</Link>
								</Column>
							</Row>
							<Row className="my-[12px]">
								<Column className="text-center">
									<Text className="my-[8px] text-[12px] leading-[24px] text-stone-500">
										Air War Trail is a subsidiary of Old Segundo Productions
									</Text>
									<Text className="mt-[4px] mb-0 text-[12px] leading-[24px] font-semibold text-stone-500">
										<Link href="mailto:info@airwartrail.com">
											info@airwartrail.com
										</Link>
									</Text>
								</Column>
							</Row>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};
