import express, { text } from "express";
import { Scraper } from "agent-twitter-client";
import fs from "fs";
import cors from "cors"


import { upload } from "./multerMiddleware.js";
import { supabase } from "./supabaseConfig.js";

const app = express();
const scraper = new Scraper();

app.use(express.json());
app.use(cors({
    origin : "*"
}));



// twitter authentication route
const isLoggedIn = async(id)=>{
    try {
        const { data, error } = await supabase
        .from('twitter')
        .select()
        .eq("user_id", id);

        const { 
          twitterUsername,
          twitterPassword,
          twitterApiKey,
          twitterAccessSecretToken ,
          twitterAccessToken,
          twitterApiSecretKey,
          twitterEmail } = data[0];

         await scraper.login(
          twitterUsername,
          twitterPassword,
          twitterEmail,
          twitterApiKey,
          twitterApiSecretKey,
          twitterAccessToken,
          twitterAccessSecretToken
        );

        const cookies = await scraper.getCookies();

        await scraper.setCookies(cookies);


    } catch (error) {
        // console.log(error);
    }
}

app.post('/tweets/:id', upload.single('media'), async (req, res) => {
  try {
    const {id} = req.params;
    const { text } = req.body;
    const media = req.file? req.file : undefined;

    await isLoggedIn(id);

    let mediaData;
    if(media){
         mediaData = [
            {
              data: fs.readFileSync(media.path),
              mediaType: media.mimetype
            },
          ];
    }

    if (!text) {
      return res.status(400).json({ error: 'Tweet text is required' });
    }

    let sendTweetResults;

    if (media)  sendTweetResults = await scraper.sendTweet(text, undefined, mediaData); // With media
    else sendTweetResults = await scraper.sendTweet(text); // Without media
        

    res.status(200).json({ message: 'Tweet posted successfully' });
  } catch (error) {
    console.error('Error posting tweet:', error);
    res.status(500).json({ error: 'Failed to post tweet' });
  }
});


app.post('/get-tweets/:id', async (req, res) => {
    try {
      const { username, limit } = req.body;
  
      // Validate input
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
  
      const tweetLimit = limit ? parseInt(limit, 10) : 10;
      const {id} = req.params;
      await isLoggedIn(id);
      
      const profile = await scraper.getProfile(username);

      console.log("user_id: ", profile)

      if(!profile){
        return res.status(400).json({
          message: "Username not found!"
        })
      }
      // Call the scraper to get tweets
      const timeline = scraper.getTweets(username, tweetLimit);

      let tweets = [];

        for await (const value of timeline) {
            tweets.push(value);
        }
        
        res.status(200).json({ username, tweets });
    } catch (error) {
      // console.error('Error fetching tweets:', error);
      res.status(500).json({ error: 'Failed to fetch tweets' });
    }
});


app.post('/profile/:id', async (req, res) => {
    try {
      const { username } = req.body;

      const {id} = req.params;
      await isLoggedIn(id)
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
  
      // Fetch profile using scraper
      const profile = await scraper.getProfile(username);
  
      res.status(200).json({ profile });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.post('/followers/:id', async (req, res) => {
try {
    const { username, limit } = req.body;

    if (!username) {
    return res.status(400).json({ error: 'Username is required' });
    }

    const followersLimit = limit ? parseInt(limit, 10) : 10;

    const {id} = req.params

    await isLoggedIn(id);

    const userId = await scraper.getUserIdByScreenName(username);
    const timeline = scraper.getFollowers(userId, followersLimit);

    let followers = [];

        for await (const value of timeline) {
            followers.push(value);
        }

    res.status(200).json({ followers });
} catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
}
});

app.post('/followings/:id', async (req, res) => {
    try {
        const { username, limit } = req.body;
    
        if (!username) {
        return res.status(400).json({ error: 'Username is required' });
        }
    
        const followersLimit = limit ? parseInt(limit, 10) : 10;
        
        const {id} = req.params

        await isLoggedIn(id);
        const userId = await scraper.getUserIdByScreenName(username);
        const timeline = scraper.getFollowing(userId, followersLimit);
    
        let following = [];
    
            for await (const value of timeline) {
                following.push(value);
            }
    
        res.status(200).json({ following });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch followers' });
    }
});

app.get('/trends/:id', async (req, res) => {
    try {
      // Fetch trends using scraper
      const {id} = req.params;
      await isLoggedIn(id)
      const trends = await scraper.getTrends();
  
      res.status(200).json({ trends });
    } catch (error) {
      console.error('Error fetching trends:', error);
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
});


app.post('/latest-tweets/:id', async (req, res) => {
    try {
      const { username } = req.body;
  
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
  
      const {id} = req.params;

      await isLoggedIn(id);
      // Fetch the latest tweet using scraper
      const latestTweet = await scraper.getLatestTweet(username);
  
      if (!latestTweet) {
        return res.status(404).json({ error: 'No tweets found for the user' });
      }
  
      res.status(200).json({ tweet: latestTweet });
    } catch (error) {
      console.error('Error fetching latest tweet:', error);
      res.status(500).json({ error: 'Failed to fetch latest tweet' });
    }
});

app.post('/get-liked-tweets/:id', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const {id} = req.params;

    await isLoggedIn(id);
    // Fetch the latest tweet using scraper
    const likedTweets = await scraper.getLikedTweets(username);

    if (!likedTweets) {
      return res.status(404).json({ error: 'No liked tweets found for the user' });
    }

    res.status(200).json({ tweet: likedTweets });
  } catch (error) {
    console.error('Error fetching latest liked tweet:', error);
    res.status(500).json({ error: 'Failed to fetch latest liked tweet' });
  }
});


app.post('/get-tweets-and-replies/:id', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const {id} = req.params;

    await isLoggedIn(id);
    // Fetch the tweets and replies using scraper
    const tweetsAndReplies = scraper.getTweetsAndReplies(username);

    if (!tweetsAndReplies) {
      return res.status(404).json({ error: 'No tweets and replies found for the user' });
    }

    res.status(200).json({ tweet: tweetsAndReplies });
  } catch (error) {
    console.error('Error fetching tweets and replies:', error);
    res.status(500).json({ error: 'Failed to fetch tweets and replies' });
  }
});

app.post('/search-profiles', async (req, res) => {
  try {
      const { query, limit } = req.body;

      // Validate input
      if (!query) {
          return res.status(400).json({ error: 'Search query is required' });
      }

      // Set default limit if not provided
      const resultLimit = limit ? parseInt(limit, 10) : 10;

      const profileResults = await scraper.fetchSearchProfiles(query, resultLimit);


      if (!profileResults || profileResults.length === 0) {
          return res.status(404).json({ message: 'No profiles found' });
      }

      res.status(200).json({
          query,
          profiles: profileResults,
      });
  } catch (error) {
      console.error('Error fetching profiles:', error);
      res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

app.post('/retweet/:id', async (req, res) => {
  try {
      const { tweetId } = req.body;

      // Validate input
      if (!tweetId) {
          return res.status(400).json({ error: 'Tweet ID is required' });
      }

      const {id} = req.params;

      await isLoggedIn(id);
      const retweetResults = await scraper.retweet(tweetId);

      res.status(200).json({
          message: 'Tweet retweeted successfully',
          data: retweetResults, 
      });
      
  } catch (error) {
      console.error('Error retweeting the tweet:', error);
      res.status(500).json({ error: 'Failed to retweet the tweet' });
  }
});

app.post('/like-tweet', async (req, res) => {
  try {
      const { tweetId } = req.body;

      // Validate input
      if (!tweetId) {
          return res.status(400).json({ error: 'Tweet ID is required' });
      }


      const likeTweetResults = await scraper.likeTweet(tweetId);

      // Check if the action was successful
      if (!likeTweetResults || !likeTweetResults.success) {
          return res.status(400).json({
              message: 'Failed to like the tweet',
              details: likeTweetResults,
          });
      }

      res.status(200).json({
          message: 'Tweet liked successfully',
          likeTweetResults,
      });
  } catch (error) {
      console.error('Error liking the tweet:', error);
      res.status(500).json({ error: 'Failed to like the tweet' });
  }
});

app.post('/quote-tweet', async (req, res) => {
  try {
      const { text, tweetId, mediaFiles } = req.body;

      // Validate required fields
      if (!text || !tweetId) {
          return res.status(400).json({
              error: 'Text and Tweet ID are required fields',
          });
      }

   
      const media = Array.isArray(mediaFiles) ? mediaFiles : [];


      const sendQuoteTweetResults = await scraper.sendQuoteTweet(text, tweetId, media);

      // Handle the scraper's response
      if (!sendQuoteTweetResults || !sendQuoteTweetResults.success) {
          return res.status(400).json({
              message: 'Failed to send the quote tweet',
              details: sendQuoteTweetResults,
          });
      }

      res.status(200).json({
          message: 'Quote tweet sent successfully',
          sendQuoteTweetResults,
      });
  } catch (error) {
      console.error('Error sending the quote tweet:', error);
      res.status(500).json({
          error: 'Failed to send the quote tweet',
      });
  }
});



// listen server
const PORT = process.env.PORT || 4000; 
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});