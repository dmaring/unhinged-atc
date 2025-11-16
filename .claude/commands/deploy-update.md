# Deploy Update Command

Update the GCP deployment with the latest code changes using the GitHub deployment method.

## Steps to execute:

1. **Build all packages locally** (optional verification):
   - Run `pnpm build` to ensure all packages (shared, client, server) build successfully
   - This verifies the code will build correctly on the instances

2. **Ensure code is pushed to GitHub**:
   - Run `git status` to check if there are uncommitted changes
   - If needed, commit and push changes to the main branch
   - Verify the branch is up to date with `git push`

3. **Perform rolling update**:
   - Run the following command to trigger a rolling update of the instance group:
     ```bash
     gcloud compute instance-groups managed rolling-action replace atc-mig --zone=us-central1-a
     ```
   - This will gradually replace instances with new ones that will:
     - Clone the latest code from GitHub
     - Install dependencies with pnpm
     - Build all packages (shared, server, client)
     - Start the application service

4. **Monitor the deployment**:
   - Check the status of the rolling update:
     ```bash
     gcloud compute instance-groups managed list-instances atc-mig --zone=us-central1-a
     ```
   - Verify new instances show HEALTHY status
   - Check logs if needed:
     ```bash
     gcloud compute instances get-serial-port-output INSTANCE_NAME --zone=us-central1-a
     ```

## Important notes:

- This deployment uses the **GitHub deployment method** - instances pull code from the repository
- Make sure you're in the project root directory
- Ensure you have the necessary GCP credentials configured
- The rolling update will minimize downtime by replacing instances gradually
- New instances will build from source during startup (takes ~2-3 minutes per instance)
- If any issues occur, you can investigate using the troubleshooting commands in CLAUDE.md

## Expected behavior:

- Local build should complete without errors (if run)
- Git status should show the branch is up to date with origin/main
- The rolling update will start replacing instances one at a time
- Each new instance will:
  - Clone from GitHub: `https://github.com/dmaring/unhinged-atc.git`
  - Run `pnpm install` to install dependencies
  - Build shared, server, and client packages
  - Start the systemd service `unhinged-atc.service`
- New instances should show HEALTHY status within 2-3 minutes
- The new code should be live and serving traffic within 5-10 minutes
