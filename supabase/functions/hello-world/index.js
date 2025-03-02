// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

/**
 * A simple Edge Function that echoes back the message sent to it
 */
Deno.serve(async (req) => {
	try {
		// Get the request body
		const { message } = await req.json();

		// Return a response with CORS headers
		return new Response(
			JSON.stringify({
				message: `Hello from Edge Function! You said: ${message || 'nothing'}`,
				timestamp: new Date().toISOString(),
			}),
			{
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			}
		);
	} catch (error) {
		// Return error response
		return new Response(
			JSON.stringify({
				error: error.message || 'Unknown error occurred',
			}),
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			}
		);
	}
});
