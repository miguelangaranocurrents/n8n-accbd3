import { test, expect } from '../../../fixtures/base';

const NODE_NAME = 'List workflows';

test.describe(
	'Credential replacement',
	{
		annotation: [{ type: 'owner', description: 'Catalysts' }],
	},
	() => {
		test('keeps the credential chosen to replace a deleted one', async ({ api, n8n }) => {
			const suffix = Date.now();
			const data = { apiKey: 'test-api-key', baseUrl: 'http://localhost:5678/api/v1' };

			const original = await api.credentials.createCredential({
				name: `Original key ${suffix}`,
				type: 'n8nApi',
				data,
			});

			const { workflowId } = await api.workflows.createWorkflowFromDefinition(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{
					name: 'Credential replacement',
					nodes: [
						{
							id: '1',
							name: 'Manual Trigger',
							type: 'n8n-nodes-base.manualTrigger',
							typeVersion: 1,
							position: [0, 0],
							parameters: {},
						},
						{
							id: '2',
							name: NODE_NAME,
							type: 'n8n-nodes-base.n8n',
							typeVersion: 1,
							position: [300, 0],
							parameters: { resource: 'workflow', operation: 'getAll' },
							credentials: { n8nApi: { id: original.id, name: original.name } },
						},
					],
					connections: {
						'Manual Trigger': { main: [[{ node: NODE_NAME, type: 'main', index: 0 }]] },
					},
					active: false,
				} as any,
				{ makeUnique: true },
			);

			const replacement = await api.credentials.createCredential({
				name: `Replacement key ${suffix}`,
				type: 'n8nApi',
				data,
			});
			await api.credentials.deleteCredential(original.id);

			await n8n.start.fromExistingWorkflow(workflowId);
			await n8n.canvas.openNode(NODE_NAME);
			await n8n.ndv.credentials.selectByName(replacement.name);
			await n8n.ndv.close();

			await expect
				.poll(
					async () => {
						const workflow = await api.workflows.getWorkflow(workflowId);
						const node = workflow.nodes.find((n) => n.name === NODE_NAME);
						return (node?.credentials?.n8nApi as { id?: string } | undefined)?.id;
					},
					{ message: 'the selected credential was not saved to the workflow', timeout: 30_000 },
				)
				.toBe(replacement.id);

			await n8n.page.reload();
			await n8n.canvas.waitForCanvasReady();
			await n8n.canvas.openNode(NODE_NAME);
			await expect(n8n.ndv.credentials.getCombobox()).toHaveValue(replacement.name);
		});
	},
);
