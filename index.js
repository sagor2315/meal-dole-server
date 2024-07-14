const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()
const cookieParser = require('cookie-parser');



// middleware
app.use(express.json())
app.use(cookieParser());

app.use(cors({
    // origin: ['https://b8a12-client-side-mdzahidulisl.web.app', 'https://b8a12-client-side-mdzahidulisl.firebaseapp.com'],
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}))




const stripe = require('stripe')(`${process.env.STRIPE_SECRET_KEY}`)

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_DB_NAME}:${process.env.USER_PASS}@cluster0.3uv6jjc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// middleware jwt

const checkLoggingInfo = (req, res, next) => {
    console.log("logging info", req.method, req.host)
    next()
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log("token is here in verify", token);

    if (!token) {
        return res.status(401).send({ message: "Permission not granted access it!" });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRETS, (err, decoded) => {
        console.log(err)
        if (err) {
            return res.status(401).send({ message: "Not accessible something went wrong!" });
        }
        console.log("Value of token", decoded);
        // req.user = decoded;
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect(); /* atakeo comment kore deploy kora lagbe */

        // database collections name
        const allMealsDataCollection = client.db("MealDoleDB").collection("mealsDataAll");
        const allUpcomingMealsData = client.db("MealDoleDB").collection("upcomingMeals");
        const allUpcomingLikesData = client.db("MealDoleDB").collection("upcomingLikes");

        const allUsersData = client.db("MealDoleDB").collection("usersDataAll");
        const allPackageData = client.db("MealDoleDB").collection("packageDataAll");
        const mealRequestData = client.db("MealDoleDB").collection("mealRequest");
        const paymentsData = client.db("MealDoleDB").collection("payments");
        const likesCollection = client.db("MealDoleDB").collection("likes");
        const reviewsCollection = client.db("MealDoleDB").collection("reviews");

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await allUsersData.findOne(query);
            const isAdmin = user?.role === 'Admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // jwt related token
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            // console.log("user is here", user);

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETS, { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' }).send({ success: true })
        })

        app.post("/logout", async (req, res) => {
            const users = req.body;
            console.log("User is currently now ", users);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true });
        })

        // User related API get and post method
        app.get("/usersData", verifyToken, verifyAdmin, async (req, res) => {
            const result = await allUsersData.find().toArray();
            res.send(result);
        })

        app.delete("/usersData/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await allUsersData.deleteOne(filter);
            res.send(result);
        })

        app.get("/usersDAta/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            console.log(email);
            console.log("Decoded email", req?.decoded?.email)
            if (email !== req?.decoded?.email) {
                return res.status(403).send({ message: "Access Forbidden!" })
            }
            const query = { email: email }
            const user = await allUsersData.findOne(query)
            console.log(user?.role === "Admin")
            let Admin = false;
            if (user) {
                Admin = user?.role === "Admin"
            }
            // console.log(Admin)
            // console.log(user?.role)
            // console.log({ Admin })
            // console.log("query is here: ", query)
            // console.log("user is here: ", user)
            res.send({ Admin })
        })

        app.patch("/usersDAta/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateData = {
                $set: {
                    role: "Admin"
                }
            }
            const result = await allUsersData.updateOne(filter, updateData);
            res.send(result);
        })

        app.post("/usersData", async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }

            const existingEmail = await allUsersData.findOne(query);
            if (existingEmail) {
                return res.send({ message: "User already exist", insertedId: null })
            }
            const result = await allUsersData.insertOne(user);
            res.send(user);
        })



        // Upcoming Meal API
        app.get("/upcomingMeal", async (req, res) => {
            const result = await allUpcomingMealsData.find().toArray();
            res.send(result);
        })

        app.get("/upcomingMeal/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allUpcomingMealsData.findOne(query)
            res.send(result);
        })

        app.get("/upcomingLikeCounter", async (req, res) => {
            const result = await allUpcomingLikesData.find().toArray();
            res.send(result);
        })

        app.get("/upcomingLikeCounter/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allUpcomingLikesData.findOne(query);
            res.send(result);
        })

        app.post("/upcomingLikeCounter", async (req, res) => {
            const upComingLike = req.body;
            const id = upComingLike.id;
            console.log("upcomingLike id is here: ", id)

            const updateUpcomingLike = {
                $inc: {
                    upcomingLike: 1
                },

                $set: {
                    // mealDetails: {
                    //     _id: new ObjectId(),
                    upMealImg: upComingLike.image,
                    upMealTitle: upComingLike.title,
                    upMealLikes: upComingLike.upMealLikes,
                    userWhoLiked: upComingLike.userWhoLiked,
                    // }
                },
            }
            const upcomingLikQuery = { _id: new ObjectId(id) }
            const upcomingLikeOptions = { upsert: true, returnDocument: 'after' }

            const updateUpcomingMealData = {
                $inc: {
                    likes: 1
                }
            }
            const upcomingMealDataQuery = { _id: new ObjectId(id) }
            const upcomingMealDataOptions = { upsert: false, returnDocument: 'after' }

            const result = await allUpcomingLikesData.findOneAndUpdate(upcomingLikQuery, updateUpcomingLike, upcomingLikeOptions);
            const result1 = await allUpcomingMealsData.findOneAndUpdate(upcomingMealDataQuery, updateUpcomingMealData, upcomingMealDataOptions);
            res.send({ result, result1 });
        })

        app.post("/upcomingMeal", async (req, res) => {
            const upMeal = req.body;
            const result = await allUpcomingMealsData.insertOne(upMeal);
            res.send(result);
        })


        // All meals post and get API
        app.get("/addMeals", async (req, res) => {
            const filter = req.query;
            console.log(filter);

            // Construct a regular expression object
            const regex = new RegExp(filter.title, 'i');

            const query = {
                mealTitle: { $regex: regex }
            };

            try {
                const result = await allMealsDataCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error in MongoDB query:", error);
                res.status(500).send("Internal Server Error");
            }
        });

        app.get("/addMeals/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allMealsDataCollection.findOne(query);
            res.send(result)
        })

        app.delete("/addMeals/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allMealsDataCollection.deleteOne(query);
            res.send(result)
        })

        app.put("/addMeals/:id", verifyToken, verifyAdmin, async (req, res) => {
            const mealInputData = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };

            const updateData = {
                $set: {
                    adminName: mealInputData.adminName,
                    adminEmail: mealInputData.adminEmail,
                    mealTitle: mealInputData.mealTitle,
                    mealType: mealInputData.mealType,
                    mealImage: mealInputData.mealImage,
                    Ingredients: mealInputData.Ingredients,
                    price: mealInputData.price,
                    ratings: mealInputData.ratings,
                    likes: mealInputData.likes,
                    postingDate: mealInputData.postingDate,
                    reviews: mealInputData.reviews,
                    description: mealInputData.description
                }
            }
            const result = await allMealsDataCollection.updateOne(query, updateData, options);
            res.send(result)
        })

        app.post("/addMeals", async (req, res) => {
            const meals = req.body;
            const result = await allMealsDataCollection.insertOne(meals)
            res.send(result)
        })

        // meal request API
        app.get("/mealRequest", verifyToken, async (req, res) => {
            console.log("Meal request email is here:", req?.query?.userEmail)
            console.log("Meal email are", req?.query?.userEmail !== req?.decoded?.userEmail)
            console.log("Meal decoded email is here:", req?.decoded?.email)

            if (req?.query?.userEmail !== req?.decoded?.email) {
                return res.status(403).send({ message: "Forbidden to access" })
            }

            let query = {};
            if (req.query?.userEmail) {
                query = { userEmail: req.query?.userEmail }
            }

            const result = await mealRequestData.find(query).sort({ requestStatus: -1 }).toArray();
            res.send(result);
        })

        app.get("/mealRequestAll", verifyToken, verifyAdmin, async (req, res) => {
            const result = await mealRequestData.find().toArray();
            res.send(result);
        })

        // app.get("")

        app.patch("/mealRequestAll/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateData = {
                $set: {
                    requestStatus: "delivered"
                }
            }
            const result = await mealRequestData.updateOne(query, updateData);
            res.send(result);
        })

        app.delete("/mealRequest/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealRequestData.deleteOne(query);
            res.send(result);
        })

        app.post("/mealRequest", verifyToken, async (req, res) => {
            const request = req.body;
            const result = await mealRequestData.insertOne(request);
            res.send(result);
        })

        // Like and review related API
        app.get("/likeButton", async (req, res) => {
            const result = await likesCollection.find().toArray()
            res.send(result)
        })

        app.post("/likeButton", async (req, res) => {
            const likeData = req.body;
            const likeId = likeData.id;
            console.log("Here s the like id", likeId)
            const updateDataLike = {
                $inc: {
                    likes: 1
                },
                $set: {
                    email: likeData.email,
                },
            }
            const updateDataMeal = {
                $inc: {
                    likes: 1
                }
            }
            const query = { _id: new ObjectId(likeId) }
            const optionsMeal = { upsert: false, returnDocument: 'after' };
            const optionsLike = { upsert: true, returnDocument: 'after' };
            const result = await likesCollection.findOneAndUpdate(query, updateDataLike, optionsLike)
            const result1 = await allMealsDataCollection.findOneAndUpdate(query, updateDataMeal, optionsMeal)
            res.send(result1)
        })


        app.get("/addReviewData/:id", async (req, res) => {
            const id = req.params.id;

            try {
                const result = await reviewsCollection.findOne(
                    { "ReviewComments._id": new ObjectId(id) }
                );

                if (!result || !result.ReviewComments || result.ReviewComments.length === 0) {
                    return res.status(404).send({ message: 'Item not found' });
                }

                const specificObject = result.ReviewComments.find(comment => comment._id.toString() === id);

                if (!specificObject) {
                    return res.status(404).send({ message: 'Specific object not found' });
                }

                res.send(specificObject);
            } catch (error) {
                console.error("get error:", error);
                res.status(500).send({ error: error.message });
            }
        });


        app.put("/addReviewData/:id", async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;

            console.log("Received ID:", id);
            console.log("Updated Data:", updatedData);

            try {
                const result = await reviewsCollection.updateOne(
                    { "ReviewComments._id": new ObjectId(id) },
                    {
                        $set: {
                            "ReviewComments.$[comment]": {
                                _id: new ObjectId(id),
                                reviewText: updatedData.reviewText,
                                userName: updatedData.userName,
                                userEmail: updatedData.userEmail,
                                userPhoto: updatedData.userPhoto,
                                likesCount: updatedData.likesCount,
                                mealTitle: updatedData.mealTitle,
                                reviews: updatedData.reviews,
                            }
                        }
                    },
                    { arrayFilters: [{ "comment._id": new ObjectId(id) }] }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Item not found or not modified' });
                }

                res.send(result);
            } catch (error) {
                console.error("edit error:", error);
                res.status(500).send({ error: error.message });
            }
        });

        app.get("/addReviewData/all/:id", async (req, res) => {
            const id = req.params.id;
            console.log("review delete all", id)
            const query = { _id: new ObjectId(id) };
            const result = await reviewsCollection.findOne(query);
            res.send(result)
        })

        app.delete("/addReviewData/:id", async (req, res) => {
            const id = req.params.id;

            try {
                const result = await reviewsCollection.updateOne(
                    {},
                    { $pull: { "ReviewComments": { _id: new ObjectId(id) } } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Item not found or not modified' });
                }

                res.send(result);
            } catch (error) {
                console.error("delete error:", error);
                res.status(500).send({ error: error.message });
            }
        });

        app.delete("/addReviewData/all/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reviewsCollection.deleteOne(query);
            res.send(result)
        })

        app.get("/addReviewData", async (req, res) => {
            const userEmail = req.query?.userEmail;

            if (!userEmail) {
                return res.send(result = await reviewsCollection.find().sort({ revLikesCount: -1 }).toArray())

            }

            const aggregationPipeline = [
                {
                    $match: {
                        "ReviewComments.userEmail": userEmail
                    }
                },
                {
                    $project: {
                        _id: 1,
                        reviews: 1,
                        ReviewComments: {
                            $filter: {
                                input: "$ReviewComments",
                                as: "comment",
                                cond: { $eq: ["$$comment.userEmail", userEmail] }
                            }
                        }
                    }
                }
            ];

            try {
                const result = await reviewsCollection.aggregate(aggregationPipeline).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error retrieving reviews:", error);
                res.status(500).send("Internal Server Error");
            }
        });



        app.post("/addReviewData", async (req, res) => {
            const review = req.body;
            const id = review._id;
            const rText = review.reviewText
            const updateDataReviews = {
                $inc: {
                    reviews: 1
                },

                $push: {
                    ReviewComments: {
                        _id: new ObjectId(),
                        reviewText: rText,
                        userName: review.userName,
                        userPhoto: review.userPhoto,
                        userEmail: review.userEmail,
                        likesCount: review.likesCount,
                        mealTitle: review.mealTitle,
                        reviews: review.reviewsInComment,
                    }
                },
                $set: {
                    reviewsComm: review.reviewsInComment,
                    mealReviewTitle: review.mealTitle,
                    revLikesCount: review.likesCount,
                }

            }

            const updateMealsData = {
                $inc: {
                    reviews: 1
                }
            }

            const query = { _id: new ObjectId(id) }
            const reviewOptions = { upsert: true, returnDocument: "after" }
            const addMealsOptions = { upsert: false, returnDocument: "after" }
            const result = await reviewsCollection.findOneAndUpdate(query, updateDataReviews, reviewOptions)
            // const resultInsert = await reviewsCollection.insertOne(review)
            const result1 = await allMealsDataCollection.findOneAndUpdate(query, updateMealsData, addMealsOptions)
            res.send({ result, result1 })
        })




        // membership packages
        app.get("/paymentPackages", async (req, res) => {
            const result = await allPackageData.find().toArray();
            res.send(result);
        })

        app.get("/paymentPackages/:packageName", async (req, res) => {
            const query = { packageName: req.params.packageName };
            // const query = { _id: new ObjectId(id) };
            const result = await allPackageData.find(query).toArray();
            res.send(result);
        })

        // for payment method
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, "price inside the intent")
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card",
                ],
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // payment related api
        app.get("/payments/:email", verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            console.log("payment email query", query)

            if (req.params.email !== req?.decoded?.email) {
                return res.status(403).send({ message: "Forbidden to access" })
            }
            console.log("The two email are: ", req?.params?.email !== req?.decoded?.email)
            console.log("The decoded email is: ", req?.decoded?.email)
            console.log("The params email is: ", req?.params?.email)

            const result = await paymentsData.find(query).toArray();
            res.send(result);
        })

        app.post("/payments", async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentsData.insertOne(payment)

            // const dataInsertToUsers = {
            //     transactionId: payment.transactionId
            // };

            console.log("payment result", payment)
            res.send({ paymentResult })
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 }); /* atake comment kore vercel e deploy kora lagbe */
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("Server is running successfully")
})

app.listen(port, () => {
    console.log(`server is successfully running here: ${port}`)
})



