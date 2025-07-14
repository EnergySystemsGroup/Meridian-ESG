// Simple hardcoded V2 switcher - no feature flags
import RunDetailPageV2 from './pageV2';

export default async function RunDetailPage(props) {
	// Await params if needed for Next.js 15 compatibility
	const resolvedProps = {
		...props,
		params: props.params ? await props.params : {},
		searchParams: props.searchParams ? await props.searchParams : {}
	};
	
	return <RunDetailPageV2 {...resolvedProps} />;
}