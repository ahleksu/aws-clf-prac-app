# ☁️ AWS CLF-C02 Practice Exam App

A responsive and interactive quiz application built with **Angular v19**, **PrimeNG**, and **TailwindCSS**, designed to help users prepare for the **AWS Certified Cloud Practitioner (CLF-C02)** exam.

## ⚖️ Disclaimer

This practice exam web application is a **personal educational project** and is **not affiliated with or endorsed by AWS, Amazon, or any official certification authority**.

All questions and explanations are **inspired by publicly available resources** and designed to help users prepare for the **AWS Certified Cloud Practitioner (CLF-C02)** exam.

If you notice any inaccuracies or have suggestions for improvement, feel free to  
[📬 file an issue](https://github.com/ahleksu/aws-clf-prac-app/issues) or open a pull request.


## 🚀 Live Demo

👉 [Try the App on Vercel](https://aws-clf-prac-app.vercel.app/)

---

## 🎯 Features

- ✅ **Domain-based quiz modes**: Take quizzes by domain or across all domains
- ✅ **Progress bar** and **question navigation**
- ✅ **Single and multiple choice support**
- ✅ **Immediate answer feedback** with explanations
- ✅ **Skip detection** for unanswered questions
- ✅ **Review mode** with filters, counts (Correct, Incorrect, Skipped), and answer breakdown
- ✅ **Donut and stacked bar charts** in result summary
- ✅ **Mobile responsive UI**
- ✅ **Open for contributions and suggestions**

---

## 📦 Technologies Used

- [Angular 19](https://angular.io/)
- [PrimeNG 19](https://primeng.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Vercel](https://vercel.com/) for deployment

---

## ⚠️ Limitations (Vercel Deployment)

Because the app is deployed as a **static SPA** on Vercel:
- 🧭 Application **state resets** on page refresh.
- 📥 No backend — **progress and results are not saved** permanently.
- 📊 Chart data is computed in-memory and not persisted.

To persist session or quiz history, consider integrating Firebase, Supabase, or another backend.

---

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## ☕ Support the Developer

Enjoying this project? Help keep the coffee flowing and development going!  
If you'd like to support my work, you can donate via GCash by tapping the image below:

<a href="https://gcash-donations-qr.s3.ap-southeast-2.amazonaws.com/GCash-QR.jpg" target="_blank" rel="noopener noreferrer">
  <img src="public/ahleksu-notion-face.png" alt="Buy Me a Coffee" width="150" style="border-radius: 50%; display: block; margin: 0 auto;" />
</a>

---

## 📬 Contact

Got feedback, ideas, or just want to say hi?

- 🔗 [LinkedIn](https://www.linkedin.com/in/ahleksu)
- 📹 [YouTube](https://youtube.com/@ahleksu)
- 💼 Email: `ahleksu.dev@gmail.com`

I'm always open to suggestions, contributions, or even just coffee chats about AWS, Angular, or anything tech!
