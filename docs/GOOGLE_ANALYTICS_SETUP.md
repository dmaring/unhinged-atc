# Google Analytics 4 Setup Guide

This guide provides step-by-step instructions for setting up Google Analytics 4 (GA4) with custom dimensions for Unhinged ATC.

## Table of Contents
1. [Creating a GA4 Property](#creating-a-ga4-property)
2. [Setting Up Custom Dimensions](#setting-up-custom-dimensions)
3. [Configuring the Application](#configuring-the-application)
4. [Testing Analytics](#testing-analytics)
5. [Custom Dimension Reference](#custom-dimension-reference)

---

## Creating a GA4 Property

### Step 1: Create Google Analytics Account (if needed)

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. Click **Start measuring** (if you don't have an account yet)
4. Follow the setup wizard to create your account

### Step 2: Create a GA4 Property

1. In Google Analytics, click **Admin** (gear icon in bottom left)
2. In the **Property** column, click **Create Property**
3. Fill in the property details:
   - **Property name**: `Unhinged ATC` (or your preferred name)
   - **Reporting time zone**: Choose your timezone
   - **Currency**: Choose your currency
4. Click **Next**
5. Fill in business details (optional) and click **Create**
6. Accept the Terms of Service

### Step 3: Set Up Data Stream

1. After creating the property, you'll be prompted to set up a data stream
2. Click **Web** (for web application)
3. Fill in the stream details:
   - **Website URL**: `https://openatc.app` (or your domain)
   - **Stream name**: `Unhinged ATC Web`
4. Click **Create stream**
5. **IMPORTANT**: Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)
   - You'll need this for the `.env.production` file

---

## Setting Up Custom Dimensions

Custom dimensions allow you to track game-specific metrics that aren't available in standard GA4 reports.

### Step 1: Access Custom Definitions

1. In Google Analytics, click **Admin** (gear icon)
2. In the **Property** column, click **Custom definitions**
3. Click **Create custom dimension**

### Step 2: Create Each Custom Dimension

Create the following custom dimensions one by one:

#### 1. Room ID
- **Dimension name**: `Room ID`
- **Scope**: Event
- **Description**: `Unique identifier for multiplayer game room`
- **Event parameter**: `room_id`
- **Click**: Create

#### 2. Controller Count
- **Dimension name**: `Controller Count`
- **Scope**: Event
- **Description**: `Number of simultaneous controllers in game`
- **Event parameter**: `controller_count`
- **Click**: Create

#### 3. Game Duration
- **Dimension name**: `Game Duration`
- **Scope**: Event
- **Description**: `Duration of game session in seconds`
- **Event parameter**: `game_duration`
- **Click**: Create

#### 4. Game End Reason
- **Dimension name**: `Game End Reason`
- **Scope**: Event
- **Description**: `Reason game ended (crash or time_limit)`
- **Event parameter**: `game_end_reason`
- **Click**: Create

#### 5. Planes Cleared
- **Dimension name**: `Planes Cleared`
- **Scope**: Event
- **Description**: `Number of planes successfully cleared`
- **Event parameter**: `planes_cleared`
- **Click**: Create

#### 6. Crashes
- **Dimension name**: `Crashes`
- **Scope**: Event
- **Description**: `Number of crashes that occurred`
- **Event parameter**: `crashes`
- **Click**: Create

#### 7. Aircraft Count (for crash events)
- **Dimension name**: `Aircraft Count`
- **Scope**: Event
- **Description**: `Number of aircraft involved in crash`
- **Event parameter**: `aircraft_count`
- **Click**: Create

#### 8. Chaos Type
- **Dimension name**: `Chaos Type`
- **Scope**: Event
- **Description**: `Type of chaos ability used`
- **Event parameter**: `chaos_type`
- **Click**: Create

#### 9. Command Type
- **Dimension name**: `Command Type`
- **Scope**: Event
- **Description**: `Type of aircraft command issued`
- **Event parameter**: `command_type`
- **Click**: Create

#### 10. Queue Position
- **Dimension name**: `Queue Position`
- **Scope**: Event
- **Description**: `Position in multiplayer queue`
- **Event parameter**: `queue_position`
- **Click**: Create

### Step 3: Verify Custom Dimensions

1. After creating all dimensions, you should see them listed in **Custom definitions**
2. Each dimension will have:
   - Name
   - Scope (Event)
   - Event parameter
   - Status (Active)

---

## Configuring the Application

### Step 1: Update the Startup Script

Since you're using the **GitHub deployment method**, the `.env.production` file is generated dynamically during instance startup. You need to update the startup script:

1. Open `/deploy/startup-script.sh`
2. Find line 65 (in the "Build client package" section)
3. Replace `G-XXXXXXXXXX` with your actual Measurement ID:
   ```bash
   VITE_GA_MEASUREMENT_ID=G-ABC123DEF4  # Your actual ID
   ```

**Why the startup script?** Your GCP instances clone code from GitHub and build it on startup. The startup script generates the `.env.production` file with the correct domain and environment variables.

### Step 2: Commit and Push Changes

1. Commit the startup script change:
   ```bash
   git add deploy/startup-script.sh
   git commit -m "feat: add Google Analytics measurement ID to production build"
   git push origin main
   ```

### Step 3: Deploy to Production

Since you use the GitHub deployment method, trigger a rolling update to redeploy with the new startup script:

```bash
gcloud compute instance-groups managed rolling-action replace atc-mig --zone=us-central1-a
```

New instances will:
- Clone the latest code (with updated startup script)
- Build with the GA measurement ID included
- Start serving traffic with analytics enabled

---

## Testing Analytics

### Step 1: Enable Debug Mode (Optional)

To see real-time analytics data during testing:

1. Install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension
2. Enable the extension
3. Open your production site in Chrome
4. Open Chrome DevTools (F12)
5. Go to the **Console** tab to see GA4 events being sent

### Step 2: Use DebugView

1. In Google Analytics, go to **Admin** > **DebugView**
2. Open your production site in a new window
3. Perform actions (login, play game, etc.)
4. You should see events appearing in real-time in DebugView
5. Click on events to verify custom parameters are being sent

### Step 3: Verify Events

Test each tracked event:

1. **Login Event**:
   - Action: Log in to the game
   - Event name: `login`
   - Check for: `method`, `username_length`

2. **Game Ended Event**:
   - Action: Play a full game until it ends
   - Event name: `game_ended`
   - Check for: `game_end_reason`, `score`, `planes_cleared`, `crashes`, `game_duration`, `room_id`, `controller_count`

3. **Crash Event**:
   - Action: Cause aircraft to crash
   - Event name: `aircraft_crash`
   - Check for: `aircraft_count`, `room_id`, `controller_count`

### Step 4: Wait for Reports

- **Real-time data**: Available within minutes in **Realtime** report
- **Full reports**: May take 24-48 hours to populate
- **Custom dimensions**: Will appear in reports after data is collected

---

## Custom Dimension Reference

### How Custom Dimensions Work

Custom dimensions are sent as **event parameters** with your analytics events. GA4 automatically indexes these parameters so you can use them in reports and explorations.

### Events Tracked

| Event Name | When Triggered | Custom Parameters |
|------------|---------------|-------------------|
| `login` | User logs into game | `method`, `username_length` |
| `game_ended` | Game session ends | `game_end_reason`, `score`, `planes_cleared`, `crashes`, `game_duration`, `room_id`, `controller_count` |
| `aircraft_crash` | Aircraft collision occurs | `aircraft_count`, `room_id`, `controller_count` |
| `chaos_used` | Chaos ability activated | `chaos_type` |
| `queue_joined` | Player joins queue | `queue_position`, `total_in_queue` |
| `queue_promoted` | Player promoted from queue | (none) |
| `aircraft_command` | Command issued to aircraft | `command_type` |

### Creating Custom Reports

#### Example: Game Completion Rate by Room

1. Go to **Explore** in Google Analytics
2. Create a new **Free form** exploration
3. Add dimensions:
   - **Room ID** (custom dimension)
   - **Event name**
4. Add metrics:
   - **Event count**
5. Add filters:
   - Event name = `game_ended`
6. Add breakdown:
   - **Game End Reason** (custom dimension)

#### Example: Average Game Duration

1. Go to **Explore** > **Free form**
2. Add dimensions:
   - **Date**
3. Add metrics:
   - **Event count**
4. Add filters:
   - Event name = `game_ended`
5. Create calculated metric:
   - Name: `Average Duration`
   - Formula: Use **Game Duration** parameter

#### Example: Crash Rate by Controller Count

1. Go to **Explore** > **Free form**
2. Add dimensions:
   - **Controller Count** (custom dimension)
3. Add metrics:
   - **Event count**
4. Add filters:
   - Event name = `aircraft_crash`
5. Segment by:
   - **Aircraft Count** (custom dimension)

---

## Privacy Considerations

The implementation includes the following privacy features:

1. **IP Anonymization**: Enabled via `anonymize_ip: true`
2. **No Personal Data**: Usernames are not sent (only username length)
3. **Production Only**: Analytics only run in production, not development
4. **GDPR Compliant**: No cookies required for basic event tracking

### Adding a Privacy Policy (Recommended)

Consider adding a privacy notice to your login screen or footer:

```
We use Google Analytics to understand how players interact with the game.
No personal information is collected. See our Privacy Policy for details.
```

---

## Troubleshooting

### Events Not Showing in GA4

1. **Check Measurement ID**: Verify `VITE_GA_MEASUREMENT_ID` in `.env.production`
2. **Check Environment**: Confirm you're in production mode (`NODE_ENV=production`)
3. **Check Console**: Look for `[Analytics] Google Analytics initialized` message
4. **Check Network**: In DevTools Network tab, look for requests to `google-analytics.com`
5. **Wait**: Some reports take 24-48 hours to populate

### Custom Dimensions Not Appearing

1. **Check Parameter Names**: Ensure event parameter names match exactly (case-sensitive)
2. **Wait for Data**: Custom dimensions only appear after data is collected
3. **Check Scope**: Ensure dimension scope is set to "Event" (not User or Session)
4. **Verify Events**: Use DebugView to confirm parameters are being sent

### DebugView Not Showing Events

1. **Clear Cache**: Clear browser cache and hard reload (Cmd+Shift+R / Ctrl+Shift+R)
2. **Disable Ad Blockers**: Some ad blockers prevent GA4 from loading
3. **Check Domain**: DebugView only works on the configured domain (not localhost)
4. **Enable Debug Extension**: Install and enable Google Analytics Debugger

---

## Next Steps

After setting up basic analytics, consider:

1. **Setting up Conversions**: Mark key events (like `game_ended`) as conversions
2. **Creating Audiences**: Segment users by behavior (e.g., frequent players, crash-prone controllers)
3. **Setting up Alerts**: Get notified when metrics exceed thresholds
4. **Connecting BigQuery**: Export raw data for advanced analysis
5. **Adding More Events**: Track additional actions like chaos abilities, aircraft spawns, etc.

---

## Support

For issues or questions:
- Google Analytics Help: https://support.google.com/analytics
- GA4 Documentation: https://developers.google.com/analytics/devguides/collection/ga4
- React-GA4 Documentation: https://github.com/codler/react-ga4
